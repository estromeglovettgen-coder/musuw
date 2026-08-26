## 1. Hosted runner routing

- [x] 1.1 Pin CI and Storefront jobs to standard `ubuntu-24.04` and enable their official caches directly
- [x] 1.2 Route production authorization and native AMD64 construction to `ubuntu-24.04` while retaining deploy on `musuw-release`

## 2. Production build simplification

- [x] 2.1 Replace the Beijing source artifact transport and preinstalled Node assumption with exact-SHA checkout and official Node setup
- [x] 2.2 Remove regional mirror and persistent BuildKit assumptions while preserving native builds, provenance, and digest validation

## 3. Contracts and documentation

- [x] 3.1 Update workflow validation and checked-in runner configuration for hosted execution
- [x] 3.2 Update deployment documentation and validate the OpenSpec change

## 4. Verification and activation

- [x] 4.1 Run workflow syntax, shell, static production, and repository contract checks
- [x] 4.2 Push the isolated change and verify fresh CI, Storefront, production build, deployment, and public health
