import ErrorStatusPage from './errors/ErrorStatusPage';
import { defaultActions, forbiddenPage } from './errors/presets';

export default function Forbidden() {
  return (
    <ErrorStatusPage
      {...forbiddenPage}
      actions={[defaultActions.home, defaultActions.contact]}
    />
  );
}
