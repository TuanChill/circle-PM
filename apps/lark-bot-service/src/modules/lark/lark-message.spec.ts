import { buildIssueAssignmentText } from './lark-message';

describe('buildIssueAssignmentText', () => {
  it('includes the assignee mention and escapes user-controlled text', () => {
    expect(
      buildIssueAssignmentText({
        issueIdentifier: 'CIR-12',
        issueTitle: '<script>alert("x")</script>',
        assigneeName: 'A & B',
        openId: 'ou_123',
      }),
    ).toBe(
      'New assignment: CIR-12 — &lt;script&gt;alert("x")&lt;/script&gt;\n<at user_id="ou_123">A &amp; B</at>',
    );
  });
});
