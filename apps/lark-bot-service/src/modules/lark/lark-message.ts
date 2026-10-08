export interface IssueAssignmentMessageInput {
  issueIdentifier: string;
  issueTitle: string;
  assigneeName: string;
  openId: string;
}

function escapeText(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(value: string) {
  return escapeText(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function buildIssueAssignmentText(input: IssueAssignmentMessageInput) {
  return [
    `New assignment: ${escapeText(input.issueIdentifier)} — ${escapeText(input.issueTitle)}`,
    `<at user_id="${escapeAttribute(input.openId)}">${escapeText(input.assigneeName)}</at>`,
  ].join('\n');
}
