# Projects catalog

The catalog was rebuilt from the 2026-09-08 GitHub CLI inventory for `choisimo`.
It includes every one of the 68 public repositories returned by `gh repo list`:
59 originals and 9 forks. Two originals have no commits and are explicitly marked
as empty repositories. Private repositories and unconfirmed secondary accounts
are excluded. GitHub fork metadata does not establish authorship or contributions.

`project-catalog-summaries.json` contains the reviewed Korean summaries. These use
the repository description, its pinned default-branch README, and root contents.
Missing descriptions and empty or documentation-only repositories are stated
explicitly. A public repository is not evidence of a running or finished service.
The language shown is GitHub's `primaryLanguage`, not an inferred framework stack.

`public/project-catalog.json` contains public-only provenance: repository URLs,
fork and empty flags, pushed and checked timestamps, and pinned commit URLs.
`public/project-data/*.md` is the Projects content source. The existing manifest
generator produces `public/projects-manifest.json`; do not edit that generated
file by hand.

To rebuild using a fresh reviewed evidence bundle containing `repositories.json`
and `evidence.json`, first review and update the summaries for its exact public
repository set. Then run from `frontend/`:

```sh
node scripts/rebuild-github-project-data.mjs /path/to/evidence/data
npm run generate-projects-manifest
node scripts/rebuild-github-project-data.mjs /path/to/evidence/data --check
```

The rebuild validates every public entry before replacing old Markdown files. It
refuses missing or stale summaries, duplicate inventory entries, and incomplete
evidence. The check compares all Markdown frontmatter and manifest fields against
the inventory and reviewed summaries, ensuring that no old or private entry remains.
Update the visible review date on `src/pages/public/Projects.tsx` for each refresh.
