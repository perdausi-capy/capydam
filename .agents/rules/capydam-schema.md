# Capydam Asset Schema Quirk: `filename` vs `originalName`

When querying or interacting with the `Asset` model in the Capydam Prisma database, keep the following naming convention in mind:

## Search & Display Behavior
The `filename` field stores the auto-generated backend identifier on disk (e.g., `1789637169999-623916864.png`). It is NOT the human-readable name of the file.
The human-readable name displayed in the Capydam UI (e.g. "Dubai Sting") is stored in the `originalName` field.

**Rule:** When executing search queries or formatting text for the user, always query and display `originalName`. Fall back to `filename` only if `originalName` is strictly unavailable, or include both in `OR` queries to ensure robustness.
