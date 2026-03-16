import ErrorStatusPage from "./errors/ErrorStatusPage";
import { defaultActions, notFoundPage } from "./errors/presets";

export default function NotFound() {
  return (
    <ErrorStatusPage
      {...notFoundPage}
      actions={[defaultActions.home, defaultActions.blog]}
    />
  );
}
