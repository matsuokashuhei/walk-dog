# API feature module migration design

## WHAT

`apps/api`は現在の公開HTTP契約を維持し、機能名からcontract、route、use case、外部接続、永続化、testを追跡できるsource構成を提供する。

### Public contract

- `GET /health`はHTTP 200と`{ "status": "ok" }`を返す。
- `GET /openapi.json`はOpenAPI 3.1文書を返す。
- `POST /v1/auth/sign-up`、`POST /v1/auth/sign-up/verify`、`POST /v1/auth/sign-in`、`POST /v1/auth/sign-in/verify`は現在のrequest schema、success status、success response、error status、error responseを返す。
- API errorは`code`、`message`、`requestId`、`retryable`を返す。
- `X-Request-Id`はrequest、response header、structured log、Sentry contextを関連付ける。
- 認証成功responseはaccess token、ID token、refresh token、Owner ID、nullable表示名、nullable avatar URL、ISO timestampを返す。

### Quality gates

| Gate | Acceptance condition |
| --- | --- |
| Baseline `npm test` | 現在の45 test名とassertionが成功する。 |
| Migrated `npm test` | 同じ45 test名とassertionがnested suiteから成功し、追加したboundary testも成功する。 |
| OpenAPI contract comparison | healthと4 auth operationのmethod、path、request、response、statusが移行前のdocumentと一致する。 |
| `npm run check` | ESLint、jscpd、knip、TypeScriptが成功する。 |
| Import boundary check | use caseのimportがmodule type、error、provider/repository interfaceで構成される。 |
| Skill consistency | `scripts/agent-skills.sh check`が成功する。 |

## HOW

### Source layout

```text
apps/api/src/
├── modules/
│   ├── health/
│   │   ├── contracts.ts
│   │   ├── routes/health.ts
│   │   └── index.ts
│   ├── auth/
│   │   ├── contracts.ts
│   │   ├── errors.ts
│   │   ├── provider.ts
│   │   ├── types.ts
│   │   ├── routes/
│   │   │   ├── sign-up.ts
│   │   │   ├── sign-up-verify.ts
│   │   │   ├── sign-in.ts
│   │   │   ├── sign-in-verify.ts
│   │   │   └── index.ts
│   │   ├── use-cases/
│   │   └── index.ts
│   └── owners/
│       ├── repository.ts
│       ├── types.ts
│       └── index.ts
├── infrastructure/
│   ├── cognito/
│   │   ├── client.ts
│   │   └── cognito-auth-provider.ts
│   ├── config/
│   ├── database/
│   │   ├── client.ts
│   │   ├── schema/owner.ts
│   │   └── repositories/drizzle-owner-repository.ts
│   └── observability/
├── shared/http/error-contract.ts
├── app.ts
├── index.ts
├── instrument.ts
└── server.ts
```

必要な機能型とinterfaceだけを各moduleへ作る。authはSign Up、Sign In、OTP確認を所有し、ownersはOwner型と永続化能力を所有する。認証確認use caseはAuthProviderとOwnerRepositoryを受け取り、両機能を合成する。

### Dependency flow

```text
HTTP route -> auth use case -> AuthProvider / OwnerRepository
                                  ^              ^
                           Cognito adapter   Drizzle repository
                                  \              /
                                composition root
```

- routeはmodule contractで検証したinputをuse caseへ渡し、feature resultを公開HTTP responseへ変換する。
- use caseは認証処理の順序、成功結果、既知の機能errorを提供する。
- AuthProviderはCognito command、SDK output、documented exceptionをmodule resultへ変換する。
- OwnerRepositoryは同一transaction内でOwner insertを試行し、unique conflict時に既存Ownerを取得してmodule typeを返す。
- `index.ts`はconfig、logger、Pool/DB、Cognito client、adapter、repository、use case、feature route、app、serverを順に接続する。
- `app.ts`は完成済みhealth/auth child appを各prefixへ一度mountし、共通middleware、OpenAPI、not-found、global errorを提供する。
- `server.ts`はlistener、signal、idempotent shutdown、resource close順序を提供する。

### Vertical migration sequence

1. 現在の45 test名、assertion、OpenAPI JSONをbaselineとして記録し、recursive default testとseparate integration testのdiscoveryを設定する。
2. Shared error、health、config、observabilityを目標配置へ移し、app境界testを継続する。
3. Owner typeとrepository interfaceをmoduleへ置き、Drizzle schema/client/repositoryをdatabase infrastructureへ移す。
4. Sign UpとSign In開始処理をAuthProvider、use case、endpoint routeへ分離する。
5. Sign Up VerifyとSign In Verifyをtoken解析、Owner解決、機能errorを含むuse caseへ分離する。
6. Auth child appを組み立て、composition rootから完成済みmodule routeをappへ渡し、server lifecycleを接続する。
7. Production importを目標pathへ統一し、OpenAPI、全test、quality gateで契約一致を確認する。

### Error ownership

- Zod validation hookは全feature共通の`INVALID_INPUT` responseを返す。
- AuthProviderはCognitoの既知exceptionをauth moduleの結果へ変換する。
- Auth use caseはprovider resultとOwner resolutionをfeature success/errorへ構成する。
- Auth routeはfeature resultを現在の400、409、429、500 responseへ変換する。
- Top-level `onError`は予期しない処理失敗を現在の`INTERNAL_ERROR` responseへ変換する。

### Tests

```text
apps/api/test/
├── modules/
│   ├── health/
│   ├── auth/
│   │   ├── routes/
│   │   ├── use-cases/
│   │   ├── auth-routes.test.ts
│   │   └── fixtures.ts
│   └── owners/
├── infrastructure/
│   ├── cognito/
│   ├── database/
│   └── observability/
├── support/
├── app.test.ts
├── composition.test.ts
├── config.test.ts
└── server.test.ts
```

- Route testsは対応する`register…Route`へuse case doubleを注入し、`app.request()`で公開contractを検証する。
- Use case testsはtyped AuthProvider/OwnerRepository fakeでdependency input、順序、short-circuit、既知error、unexpected error propagationを検証する。
- Cognito adapter testsはrecording senderでcommand input、output変換、exception変換を検証する。
- Drizzle repository testsはtransaction/query境界を検証し、PostgreSQL concurrency scenarioを`*.integration.ts`へ配置する。
- Aggregate testは4 endpointの一意なmethod/pathをOpenAPIから検証する。
- Composition testはfactory順序、shared instance、route注入、import時のproduction side effect境界を検証する。
- Server testはlistener、signal、idempotent shutdown、resource close一回を検証する。

### Official guidance applied

- Hono App and Routing: child applicationはendpoint登録完了後に`app.route()`でmountする。top-level appは`notFound`と`onError`を提供する。
- Hono Best Practices: route pathとhandlerを同じendpoint moduleに置き、型推論可能な境界を維持する。
- Hono Testing and Testing Helper: HTTP contract testsはlistenerを起動せず`app.request()`を使用する。
- Node.js Test Runner: quoted recursive patternでnested `*.test.ts`をdefault suiteへ含め、`*.integration.ts`をseparate commandで実行する。

## WHY

この構成は、active R1の公開機能と検証条件を維持しながら、新規開発者が`modules/auth`または`modules/owners`から関連処理を一方向に追跡できる状態を提供する。Vertical sliceごとに同じHTTP contractを確認するため、構造変更の差分をendpoint単位で評価できる。PR2完了後のPR3は、各技術skillを実装済みのmodule/infrastructure境界へ整合させる。

## References

- <https://hono.dev/d%6Fcs/api/hono>
- <https://hono.dev/d%6Fcs/api/routing>
- <https://hono.dev/d%6Fcs/guides/best-practices>
- <https://hono.dev/d%6Fcs/guides/testing>
- <https://hono.dev/d%6Fcs/helpers/testing>
- <https://nodejs.org/api/test.html>
