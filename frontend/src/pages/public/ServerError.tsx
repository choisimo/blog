import ErrorStatusPage from './errors/ErrorStatusPage';
import { defaultActions, serverErrorPage } from './errors/presets';

export default function ServerError() {
  return (
    <ErrorStatusPage
      {...serverErrorPage}
      actions={[defaultActions.retry, defaultActions.home]}
    />
  );
}
