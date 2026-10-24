# Plan shape

The sections an OttLib plan uses. Leave out a section that has nothing in it; add design sections as the topic needs.

```
# <Title>

Approved by the user (<date>: "<their words>").   <- added on approval
Issue: #<n>                                         <- added on approval (writer-issuer); /plan-runner's PR closes it
<One or two lines: where the ask came from.>

## 1. Why
- **<Problem in bold.>** What happens today, with path:line.

## 2. Decisions
User (<date>):
- **<Call.>** <One line why.>

Taken on the coordinator's recommendation (when the user said "go as you recommend"):
- **<Call.>** Picked: <option>. Rejected: <option> (<why>).

## 3.. <Design sections>
One per system the change touches: the files per layer (route, service, repository, provider), the migration, the shared
types and schemas, the Android DTOs and ViewModels, the values.

## <n>. API and contract   (a response or endpoint changes)
The shared schema, the contract fixtures to re-record, the Kotlin DTO, and whether `apiVersion` must bump (breaking only).

## <n>. Screens   (UI changes)
Web at phone and desktop widths (and dark mode); TV: the focus path, initial focus, focus restore and Back; mobile: the
window width classes, the Fold's cover and inner screens, tabletop posture and PiP.

## <n>. Tests to change or add

## <n>. Tasks
| Task | Files | Spec | Depends on | Checks |
|---|---|---|---|---|
| T1 <title> | <files> | full / partial | – | <2–5 things true when done, separated by ";"> |
Spec: `full` when the plan says exactly what to build, `partial` when the builder must decide.
Tasks that edit the same file are one task, or run in order. Say which can run alongside each other.

## <n>. Risks and known gaps

## <n>. Progress log
- <date>: plan written and approved.
```
