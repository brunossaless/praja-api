# Auth (JWT)

## Variáveis de ambiente

Defina no seu ambiente (ou em um arquivo `.env`):

- `JWT_SECRET`: segredo usado para assinar/validar o token (obrigatório)
- `JWT_EXPIRES_IN`: expiração do token (ex.: `1d`, `12h`, `3600s`) — padrão `1d`
- `PORT`: porta do servidor (padrão `3000`)

## Login

Endpoint:

- `POST /auth/login`

Body:

- `email` (string)
- `password` (string)

Resposta:

- `access_token`
- `user` (sem `password`)

## Usar o token nas outras requests

Envie o header:

- `Authorization: Bearer <access_token>`

Exemplo: `GET /users/:id` requer token.

