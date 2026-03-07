# Application Layer Scaffolding

This directory hosts the service abstraction boundary:

- `ports/`: contracts (interface-like definitions via JSDoc + runtime assertions)
- `services/`: application services/use cases that depend only on ports
- `usecases/`: domain-oriented orchestration skeletons for phased migration

Target dependency direction:

`routes -> application(usecases/services) -> ports -> adapters(infra)`

