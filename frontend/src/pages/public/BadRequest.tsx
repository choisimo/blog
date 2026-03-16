import ErrorStatusPage from './errors/ErrorStatusPage';
import { badRequestPage, defaultActions } from './errors/presets';

export default function BadRequest() {
  return (
    <ErrorStatusPage
      {...badRequestPage}
      actions={[defaultActions.home, defaultActions.back]}
    />
  );
}
