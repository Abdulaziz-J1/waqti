import { today } from '@shared/strings'
import { PageHeader } from '../components/PageHeader'

export function TodayPage(): React.JSX.Element {
  return <PageHeader title={today.title} />
}
