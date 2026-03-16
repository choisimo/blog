import ErrorStatusPage from './errors/ErrorStatusPage';
import { defaultActions, tooManyRequestsPage } from './errors/presets';

export default function TooManyRequests() {
  return (
    <ErrorStatusPage
      {...tooManyRequestsPage}
      actions={[defaultActions.retry, defaultActions.home]}
    />
  );
}
