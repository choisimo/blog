import ErrorStatusPage from './errors/ErrorStatusPage';
import { defaultActions, serviceUnavailablePage } from './errors/presets';

export default function ServiceUnavailable() {
  return (
    <ErrorStatusPage
      {...serviceUnavailablePage}
      actions={[defaultActions.retry, defaultActions.home]}
    />
  );
}
