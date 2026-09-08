# Branch Review Checklist

## Specification

- The branch explicitly read `Znawca 需求规格说明书 V1.0.docx`.
- Original Word/chat conflicts do not override V1.0.
- Per-question testing timer is off or 10/15/20 seconds.
- Visual work follows velvet green, gold frames, and metallic controls.

## Engineering

- Files stay inside the assigned ownership boundary.
- Public types and errors are documented and deterministic.
- Renderer code has no direct filesystem or Node access.
- Core modules are independent from Electron and React.
- Invalid course/media input cannot crash the application.
- Tests are deterministic and do not require the network.

## Verification

- Unit tests pass.
- Type checking passes.
- Production build passes where applicable.
- A reviewer can reproduce the result from the branch commit.
- Known gaps are explicit and mapped to a later workstream.

Branches that fail any required item receive a corrective follow-up and remain under monitoring.

