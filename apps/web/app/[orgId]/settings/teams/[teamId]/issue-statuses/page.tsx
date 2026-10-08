import MainLayout from '@/components/layout/main-layout';
import Header from '@/components/layout/headers/settings/header';
import TeamIssueStatusesSettings from '@/components/common/settings/team-issue-statuses-settings';

export default async function Page({ params }: { params: Promise<{ teamId: string }> }) {
   const { teamId } = await params;
   return (
      <MainLayout header={<Header />} headersNumber={1}>
         <TeamIssueStatusesSettings teamId={teamId} />
      </MainLayout>
   );
}
