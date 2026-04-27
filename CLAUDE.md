# CLAUDE.md — api/

This file provides guidance to Claude Code when working inside the `api/` workspace.

## Documentation

Before implementing or changing anything, read the relevant doc:

| Task | Read first |
|---|---|
| HTTP routes, WebSocket, auth, visibility rules | `docs/api.md` |
| Schema, entities, constraints | `docs/database.md` |
| Stack, modules, infra | `docs/architecture.md` |
| Open/frozen architectural decisions | `docs/decisions.md` |

If docs and code conflict, flag the mismatch — do not silently ignore `docs/`.

## Controller conventions

Every controller must follow these patterns (`requests.controller.ts` is the reference):

- **Class decorators**: `@ApiTags('<domain>')`, `@ApiBearerAuth('access-token')`, `@Controller('<path>')`.
- **Method decorators**: every endpoint needs `@ApiOperation({ summary })` **and** a response decorator (`@ApiOkResponse` / `@ApiCreatedResponse`) with an explicit `type` — omitting `type` produces `Record<string, never>` in generated types.
- **No business logic in controllers** — validate input (pipes/DTOs), delegate to services. Transactions belong in services.
- **UUID params**: always `@Param('id', ParseUUIDPipe)`.
- **Auth**: `@CurrentUser() u: JwtUserPayload` for authenticated routes.
- **DTOs**: response DTOs in `api/src/common/dto/responses.dto.ts`; request DTOs colocated in the domain's `dto/` folder.
- **Errors**: throw `ApiException`, not raw `HttpException`.

## Migration discipline

When adding, removing, or renaming entity columns, relations, or indexes:

1. Generate a migration: `npm run migration:generate -- src/database/migrations/<TimestampDescription>` (from `api/`).
2. Run it: `npm run migration:run`.
3. Verify rollback: `npm run migration:revert` must succeed.
4. One migration per logical change — do not batch unrelated schema changes.

Never rely on `synchronize: true`. After pulling code that touches entity files, run `npm run migration:run` if there are pending migrations.

## OpenAPI codegen

After changing a response DTO or adding `@ApiProperty` decorators:

1. Update the class in `api/src/common/dto/responses.dto.ts` with `@ApiProperty` / `@ApiPropertyOptional({ type: <Type>, nullable: true })`.
2. Annotate the controller endpoint with `@ApiOkResponse({ type: DtoClass })` or `@ApiCreatedResponse`.
3. With the API running, trigger `npm run openapi:gen` in `mobile/` and `admin/`. Commit the updated generated files.
