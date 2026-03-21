import ErrorStatusPage from './errors/ErrorStatusPage';
import { defaultActions, unauthorizedPage } from './errors/presets';

export default function Unauthorized() {
  return (
    <ErrorStatusPage
      {...unauthorizedPage}
      actions={[defaultActions.home, defaultActions.contact]}
    />
  );
}
