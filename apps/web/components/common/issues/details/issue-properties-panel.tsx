'use client';

import type { IssueDetail } from '@/mock-data/issue-details';
import type { Issue } from '@/mock-data/issues';
import type { LabelInterface } from '@/mock-data/labels';
import { GitPullRequestArrow } from 'lucide-react';
import { AssigneeUser } from '../assignee-user';
import { CycleSelector } from '../cycle-selector';
import { LabelBadge } from '../label-badge';
import { PrioritySelector } from '../priority-selector';
import { EstimateSelector } from '../estimate-selector';
import { StatusSelector } from '../status-selector';
import { LabelSelector } from '@/components/layout/sidebar/create-new-issue/label-selector';
import { RelationSelector } from '../relation-selector';
import { renderProjectIcon } from '@/lib/project-utils';
import { IssueRefRow } from './content-blocks';
import { useDeleteIssueRelation, useUpdateIssue } from '@/hooks/queries/use-issues-query';

interface IssuePropertiesPanelProps {
   issue: Issue;
   detail: IssueDetail;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
   return (
      <div>
         <h3 className="text-xs font-medium text-muted-foreground mb-2">{title}</h3>
         {children}
      </div>
   );
}

/**
 * Right sidebar of the issue page: editable properties (status, priority,
 * assignee), cycle, labels, project + milestone, relations and linked PRs.
 */
export function IssuePropertiesPanel({ issue, detail }: IssuePropertiesPanelProps) {
   const updateIssueMutation = useUpdateIssue();
   const deleteRelationMutation = useDeleteIssueRelation();

   const handleLabelsChange = (newLabels: LabelInterface[]) => {
      updateIssueMutation.mutate({
         identifier: issue.identifier,
         data: { labelIds: newLabels.map((label) => label.id) },
      });
   };

   return (
      <div className="flex flex-col gap-7">
         <Section title="Properties">
            <div className="flex flex-col gap-1.5">
               <div className="flex items-center gap-1.5 -ml-1.5">
                  <StatusSelector status={issue.status} issueId={issue.id} teamId={issue.teamId} />
                  <span className="text-sm">{issue.status.name}</span>
               </div>
               <div className="flex items-center gap-1.5 -ml-1.5">
                  <PrioritySelector priority={issue.priority} issueId={issue.id} />
                  <span className="text-sm">{issue.priority.name}</span>
               </div>
               <div className="flex items-center gap-1.5 -ml-1.5">
                  <EstimateSelector
                     estimate={issue.estimate}
                     settings={issue.estimateSettings}
                     onChange={(estimate) =>
                        updateIssueMutation.mutate({
                           identifier: issue.identifier,
                           data: { estimate },
                        })
                     }
                  />
               </div>
               <div className="flex items-center gap-2 mt-0.5">
                  <AssigneeUser user={issue.assignee} issueIdentifier={issue.identifier} />
                  <span className="text-sm">{issue.assignee ? issue.assignee.name : 'Assign'}</span>
               </div>
               <div className="flex items-center -ml-1.5 mt-0.5">
                  <CycleSelector cycleId={issue.cycleId} issueId={issue.id} teamId={issue.teamId} />
               </div>
            </div>
         </Section>

         <Section title="Labels">
            <div className="flex items-center flex-wrap gap-1.5">
               <LabelBadge label={issue.labels} />
               <LabelSelector selectedLabels={issue.labels} onChange={handleLabelsChange} />
            </div>
         </Section>

         {issue.project && (
            <Section title="Project">
               <div className="flex items-center gap-2 text-sm">
                  {renderProjectIcon(issue.project.icon, 'size-4 text-muted-foreground shrink-0')}
                  <span className="truncate">{issue.project.name}</span>
               </div>
               {detail.milestone && (
                  <div className="flex items-center gap-2 text-sm mt-1.5 pl-6 text-muted-foreground">
                     <span className="size-2 rotate-45 border border-amber-400 shrink-0" />
                     <span className="truncate">{detail.milestone}</span>
                  </div>
               )}
            </Section>
         )}

         <Section title="Relations">
            <div className="flex flex-col gap-1.5">
               {detail.relations?.map((relation) => (
                  <div key={relation.id} className="flex items-center gap-2 text-sm min-w-0 group">
                     <span className="text-xs text-muted-foreground shrink-0">
                        {relation.relationType === 'blocked_by'
                           ? 'Blocked by'
                           : relation.relationType === 'blocks'
                             ? 'Blocks'
                             : relation.relationType === 'duplicate_of'
                               ? 'Duplicate of'
                               : 'Related'}
                     </span>
                     <IssueRefRow identifier={relation.identifier} />
                     <button
                        type="button"
                        className="ml-auto hidden group-hover:inline text-[11px] text-muted-foreground hover:text-destructive"
                        onClick={() => {
                           if (window.confirm('Remove this issue relation?')) {
                              deleteRelationMutation.mutate({
                                 identifier: issue.identifier,
                                 relationId: relation.id,
                              });
                           }
                        }}
                        disabled={deleteRelationMutation.isPending}
                     >
                        Remove
                     </button>
                  </div>
               ))}
               <RelationSelector issueIdentifier={issue.identifier} teamId={issue.teamId || ''} />
            </div>
         </Section>

         {detail.prLinks && detail.prLinks.length > 0 && (
            <Section title="Diffs">
               <div className="flex flex-col gap-1">
                  {detail.prLinks.map((pr) => (
                     <div key={pr.id} className="flex items-center gap-2 text-sm min-w-0">
                        <GitPullRequestArrow
                           className={
                              'size-3.5 shrink-0 ' +
                              (pr.status === 'merged' ? 'text-purple-400' : 'text-green-500')
                           }
                        />
                        <span className="text-muted-foreground shrink-0">{pr.id}</span>
                        <span className="truncate">{pr.title}</span>
                        <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
                           {pr.status}
                        </span>
                     </div>
                  ))}
               </div>
            </Section>
         )}
      </div>
   );
}
