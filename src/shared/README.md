# shared/

This folder is reserved for **pure, framework-agnostic utility code** that has
no dependency on the NestJS request/response cycle — code that could
theoretically be lifted into a standalone npm package with no knowledge of
"products," "orders," or any other feature (see `SYSTEM_ARCHITECTURE.md` §5).

It is intentionally empty at this stage. `common/` currently holds all
cross-cutting building blocks because everything implemented so far
(guards, filters, interceptors, pipes, decorators) plugs directly into the
NestJS pipeline and is therefore a `common/` concern, not a `shared/` one
(see `SYSTEM_ARCHITECTURE.md` §5–6 for the precise boundary).

Code should only be added here if it is pure, side-effect-free, and has no
awareness of HTTP, Mongoose, or any NestJS decorator.
