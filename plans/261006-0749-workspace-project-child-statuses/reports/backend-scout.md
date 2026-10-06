# Backend scout: workspace project child statuses

## Kết luận

Backend hiện chưa có thực thể/status registry cho project. `projects.status_id` và
`projects.status_category` chỉ là hai chuỗi được kiểm tra bởi một allow-list tĩnh;
`ProjectsService` cũng chuyển chúng qua một map tĩnh để trả response. Để hỗ trợ
`Backlog`, `Planned`, `In Progress`, `Completed`, `Canceled` với nhiều status con như
ảnh Linear, nên thêm registry status cấp workspace, giữ category trên từng row và
giữ `projects.status_id` như khóa tham chiếu trong giai đoạn chuyển tiếp.

Khuyến nghị triển khai tối thiểu:

- Tạo entity/table `project_statuses` (hoặc tên tương đương) với
  `id`, `workspace_id`, `name`, `color`, `category`, `position`, timestamps và
  `archived_at`/`deleted_at` nếu UI cần ẩn status mà không mất lịch sử.
- `category` dùng một enum ứng dụng ổn định: `backlog`, `planned`, `started`,
  `completed`, `canceled`. Category là nhóm Kanban; `name`, `color`, `position` là
  status con tùy biến. Không nên dùng `statusCategory` hiện tại làm danh sách con,
  vì giá trị cũ là `unstarted` cho trạng thái chưa bắt đầu.
- Bảo đảm unique `(workspace_id, id)` hoặc dùng UUID/global id; thêm index
  `(workspace_id, category, position)` và index `projects.status_id` nếu truy vấn
  status sẽ tăng. Không cần bảng category riêng cho 5 nhóm cố định.
- Backfill một bộ status mặc định cho từng workspace và remap project cũ theo
  `(status_id, status_category)`. Giữ ID legacy làm `legacy_key` hoặc tạo ID ổn định
  có hậu tố workspace để tránh một status global bị dùng nhầm giữa các workspace.
- Khi đọc project, resolve status từ registry; trong thời gian chuyển tiếp fallback
  về map tĩnh hiện tại nếu row chưa có. Khi ghi project, chỉ chấp nhận status thuộc
  workspace của project và category được khai báo trên row.

## Bằng chứng code hiện tại

### Model và validation

- `Project` chỉ có `statusId` và `statusCategory`, đều là `varchar` có default;
  không có `workspaceId` hay quan hệ tới status entity: `apps/project-service/src/data-access/project/project.entity.ts:26-30`.
- Allow-list hiện chỉ cho phép các ID cố định `backlog`, `in-progress`, `done`,
  `canceled`, `paused`; category chỉ gồm `backlog`, `started`, `completed`,
  `canceled`, `unstarted`: `apps/project-service/src/modules/projects/project-rules.ts:1-15`.
- Mapping ID -> category cũng tĩnh và `paused` được coi là `unstarted`:
  `apps/project-service/src/modules/projects/project-rules.ts:20-26`. Đây là điểm
  cần đổi để `planned` có thể là category riêng và nhiều child ID có thể cùng category.
- Validation hiện kiểm tra cả ID và category, rồi buộc hai giá trị khớp mapping tĩnh:
  `apps/project-service/src/modules/projects/project-rules.ts:37-51`. Khi dùng registry,
  logic này nên nhận status record đã resolve thay vì allow-list hard-code.
- Response project dựng status từ `STATUS_DATA`; status lạ chỉ được hiển thị bằng
  chính ID và màu fallback: `apps/project-service/src/modules/projects/projects.service.ts:41-56`
  và `:315-320`. Nên trả `{ id, name, color, category }` từ row tùy biến, có fallback
  legacy trong lúc rollout.
- DTO create/update cho phép người gọi gửi chuỗi `statusId` và `statusCategory`:
  `apps/project-service/src/modules/projects/dto/project.dto.ts:44-52` và
  `:151-159`. Đây là public contract cần giữ tương thích, nhưng service phải resolve ID
  theo workspace thay vì tin cặp chuỗi từ client.
- Create dùng default `in-progress`/`started` và ghi thẳng hai field vào project:
  `apps/project-service/src/modules/projects/projects.service.ts:706-718` và
  `:733-751`. Update cũng ghi từng field độc lập sau validation:
  `apps/project-service/src/modules/projects/projects.service.ts:781-804` và
  `:822-839`. Khi chuyển sang child status, nên xử lý một status row trong cùng
  transaction/flush và luôn cập nhật category theo row để không tạo cặp lệch.

### Scope và module wiring

- Project có thể liên kết nhiều team nhưng `validateProjectTeamIds` buộc mọi team
  thuộc cùng một workspace: `apps/project-service/src/modules/projects/projects.service.ts:134-160`.
  Đây là nguồn workspace đáng tin cậy cho status registry; lấy workspace từ
  `project.teamId`/team row, không nhận `workspaceId` tự do trong request update.
- `getAccessibleTeamIds` lọc team theo workspace mà member truy cập được:
  `apps/project-service/src/modules/projects/projects.service.ts:103-118`.
  `assertProjectAccess` cho phép đọc/sửa project nếu member có ít nhất một team
  accessible: `apps/project-service/src/modules/projects/projects.service.ts:125-131`.
- `findAll` nhận `workspaceId` hoặc `slug`, resolve qua workspace access rồi chỉ lấy
  team trong workspace đó: `apps/project-service/src/modules/projects/projects.service.ts:371-407`.
  Endpoint danh sách status có thể áp dụng cùng quy tắc resolve ID/slug.
- `ProjectsModule` hiện chỉ import `WorkspacesModule`, expose controller/service:
  `apps/project-service/src/modules/projects/projects.module.ts:1-11`. Nếu status
  dùng service riêng, add provider/module ở đây; nếu giữ trong `ProjectsService`,
  tránh tạo module vòng với workspace module.
- `ALL_ENTITIES` là danh sách entity thủ công. Entity mới phải được import và đăng ký
  ở `apps/project-service/src/data-access/all.entity.ts:21-35` và `:51-91`, đồng thời
  export từ `apps/project-service/src/data-access/project/index.ts` (module index
  hiện là nơi export các project entities). Bỏ sót bước này sẽ làm MikroORM không
  nhận schema/entity.

## API và authorization tối thiểu

### Endpoint đề xuất

Dùng workspace scope cho registry, ví dụ:

- `GET /workspaces/:workspaceId/project-statuses`: mọi member có quyền truy cập
  workspace được xem, trả nhóm theo category, ordered bởi `position`.
- `POST /workspaces/:workspaceId/project-statuses`: tạo child status với `name`,
  `color`, `category`, tùy chọn `position`; chỉ Owner/Admin.
- `PATCH /workspaces/:workspaceId/project-statuses/:statusId`: sửa name/color/category/
  position; chỉ Owner/Admin. Đổi category phải kiểm tra status đang được project
  dùng và quyết định policy rõ ràng (cho phép chuyển nhóm hoặc yêu cầu migrate).
- `DELETE` hoặc archive cùng route: chỉ Owner/Admin; không xóa cứng status đang được
  project tham chiếu. Cần yêu cầu `replacementStatusId` hoặc chuyển project về
  default cùng category trước khi archive.
- `PATCH .../reorder` hoặc nhận `position` trong PATCH để reorder trong category;
  server chuẩn hóa vị trí và không tin `workspaceId`/category của một workspace khác.

Giữ `PATCH /projects/:id` để gán status là ít breaking nhất. Khi `statusId` được gửi,
service cần lấy project, xác định workspace từ team, load status row với điều kiện
`id + workspace_id + archived_at is null`, rồi set `project.statusId` và
`project.statusCategory` từ row. Không cho client gửi category khác row. Nếu chỉ gửi
category mà không có child ID, nên từ chối 400 thay vì tự đoán.

### Pattern authorization hiện có

- Workspace access được tính bằng membership, team membership và ownership:
  `apps/project-service/src/modules/workspaces/workspaces.service.ts:50-73`.
- `WorkspacesService.findOne` trả 404 nếu member không có access và tính `canManage`
  theo owner hoặc role: `apps/project-service/src/modules/workspaces/workspaces.service.ts:147-200`.
- Helper quản trị workspace chỉ cho `Owner`/`Admin`: `apps/project-service/src/modules/access-control.ts:14-16`.
- Pattern service hiện dùng để chặn thao tác quản trị là load workspace + membership,
  sau đó yêu cầu role/owner; ví dụ `MembersService.assertWorkspaceManager`:
  `apps/project-service/src/modules/members/members.service.ts:34-58`, và regenerate
  invite code: `apps/project-service/src/modules/workspaces/workspaces.service.ts:383-404`.

Status registry nên dùng cùng pattern, trả 404 cho workspace không tồn tại/không
accessible để tránh leak và 403/404 nhất quán theo convention. List/read chỉ cần
`getAccessibleWorkspaceIds`; create/update/archive/reorder nên gọi helper tương đương
`assertWorkspaceManager`. Gán status vào project dùng `assertProjectAccess` hiện có,
không mở rộng quyền chỉ vì status thuộc workspace.

## Migration và backfill

### Schema baseline

- Baseline tạo `projects` với `status_id` default `in-progress`, `status_category`
  default `started`, không có FK: `apps/project-service/src/database/migrations/Migration20260824074759.ts:55-57`.
- Workspace và membership là schema riêng; `workspace_user_members` có unique
  `(workspace_id, member_id)`: `apps/project-service/src/database/migrations/Migration20260903081252.ts:15-25`.
  Team được thêm `workspace_id` nullable: `:35-40`, nên backfill phải xử lý project/team
  orphan hoặc team chưa có workspace.
- MikroORM migration chạy từ `src/database/migrations`, dùng bảng riêng
  `project_service_migrations`, và không snapshot/không quản lý shared `users`:
  `apps/project-service/mikro-orm.config.ts:6-23`. Migration mới cần theo đúng
  timestamp class và `up/down`; package scripts xác nhận các lệnh `migration:*`:
  `apps/project-service/package.json:23-31`.

### Backfill được khuyến nghị

1. Migration A tạo `project_statuses` với workspace/category/name/color/position và
   index/unique cần thiết. Tạo seed status mặc định cho mọi workspace hiện có.
2. Trong cùng migration hoặc migration B, lấy workspace của project qua `teams.workspace_id`.
   Chỉ backfill project/team có đúng một workspace; ghi nhận orphan/ambiguous rows
   để operator xử lý, không tự gán sang workspace ngẫu nhiên.
3. Map legacy values tối thiểu:
   `backlog -> backlog`, `in-progress -> started`, `done -> completed`,
   `canceled -> canceled`, `paused -> planned` (hoặc giữ `unstarted` nếu product
   quyết định không đổi semantics). Vì yêu cầu có `Planned`, cần chốt mapping này
   trước migration; hiện code chưa có category `planned`.
4. Cập nhật `projects.status_id` thành ID của status row tương ứng, đồng thời set
   `status_category` theo row. Nếu cần giữ client cũ, lưu `legacy_key`/`legacy_category`
   trên status row thay vì tiếp tục phụ thuộc map code.
5. Migration B có thể thêm FK sau khi mọi row hợp lệ; nếu hệ thống hiện chưa dùng FK
   cho project join tables thì ít rủi ro hơn là enforce ngay trong migration đầu tiên.

Seed service chỉ chạy khi không có project và hard-code status cũ tại
`apps/project-service/src/modules/seed/seed.service.ts:150-210`; sau khi thêm registry,
seed mặc định nên tạo status rows trước khi tạo project. Dữ liệu seed cũ không đại
diện cho workspace child statuses và không nên dùng để suy ra custom status.

### Rủi ro rollback

- `down` xóa status rows có thể làm mất custom name/color/position và không thể phục
  hồi từ các project nếu chỉ còn legacy ID. Cần backup/export status registry trước
  migration; trong codebase hiện không thấy migration backup helper.
- Nếu `projects.status_id` đã đổi từ legacy key sang UUID, rollback phải map ngược
  bằng `legacy_key`; nếu không có cột này thì rollback không xác định được `in-progress`
  hay một custom status cùng category.
- Không thể rollback an toàn việc đổi `paused -> planned` nếu không lưu category cũ;
  giữ `legacy_category` hoặc dùng migration riêng có mapping đảo được.
- Migration A/B giữa các deploy có thể khiến API cũ gửi `paused`/`in-progress` trong
  khi API mới chỉ nhận row IDs. Nên rollout đọc fallback trước, backfill, rồi mới bật
  ghi ID registry; tránh đổi schema và code validation không đồng thời.
- Xóa/archive status đang được project dùng có thể làm project không render được hoặc
  rơi vào fallback. Bắt buộc replacement/soft archive và kiểm tra reference trước khi
  cho phép thao tác.
- `teams.workspace_id` nullable và project có thể có nhiều team; backfill qua team
  primary mà không kiểm tra tất cả team cùng workspace sẽ tạo cross-workspace status
  leak. Quy tắc hiện tại đã có kiểm tra workspace đồng nhất trong service
  (`projects.service.ts:154-160`), migration nên tái hiện bằng SQL audit.

## Phạm vi test backend cần bổ sung khi implement

- Rules: custom child IDs hợp lệ khi thuộc category tương ứng; reject unknown,
  archived hoặc category mismatch; `planned` không bị coi là `unstarted` ngoài policy.
- Service: project create/update chỉ nhận status thuộc workspace của project; status
  của workspace khác trả lỗi và không flush; response resolve name/color/position.
- Authorization: regular member được list/đọc, nhưng chỉ Owner/Admin create/update/
  archive/reorder; member ngoài workspace nhận 404.
- Migration: workspace có project cho từng legacy status được map đúng; orphan team,
  null workspace, duplicate/default collision và rollback mapping được kiểm tra bằng
  migration-level SQL tests hoặc fixture review.

## Câu hỏi còn mở

- `Planned` có phải category mới chính thức hay chỉ là tên hiển thị cho category
  `unstarted` hiện tại? Mapping `paused` phụ thuộc quyết định này.
- Status ID mới có cần giữ dạng slug dễ đọc cho client, hay chấp nhận UUID và dùng
  `legacy_key` cho tương thích?
- Owner/Admin có phải là nhóm duy nhất được quản lý project statuses, hay team lead
  cũng được phép như pattern `canManageTeamRole` hiện có?
- Khi archive status cuối cùng trong một category, UI/API có bắt buộc giữ ít nhất một
  default status cho category đó không?

## Phạm vi scouting

Chỉ đọc source và plan files; không chạy test, không kết nối/chỉnh sửa database và
không sửa implementation.
