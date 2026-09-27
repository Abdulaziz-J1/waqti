import { onboarding } from '@shared/strings'
import { Button } from '../components/Button'
import { api } from '../lib/api'

export function Onboarding(): React.JSX.Element {
  return (
    <div style={{ position: 'relative', zIndex: 1, padding: 48 }}>
      <h1>{onboarding.welcomeTitle}</h1>
      <Button
        variant="primary"
        onClick={() => void api.invoke('onboarding:complete', { launchAtStartup: false })}
      >
        {onboarding.start}
      </Button>
    </div>
  )
}
