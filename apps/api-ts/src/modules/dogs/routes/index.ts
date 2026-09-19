import { OpenAPIHono } from '@hono/zod-openapi'
import type { AccessTokenVerifier } from '../../../shared/http/access-token.js'
import { createAuthenticationMiddleware } from '../../../shared/http/authentication-middleware.js'
import type { App, AppVariables } from '../../../shared/http/types.js'
import type { CreateDog, GetDog, ListDogs } from '../types.js'
import { registerCreateDogRoute } from './create-dog.js'
import { registerGetDogRoute } from './get-dog.js'
import { registerListDogsRoute } from './list-dogs.js'

export type DogRouteDependencies = {
  listDogs: ListDogs
  createDog: CreateDog
  getDog: GetDog
  accessTokenVerifier: AccessTokenVerifier
}

export function registerDogRoutes(dependencies: DogRouteDependencies): App {
  const app = new OpenAPIHono<{ Variables: AppVariables }>()
  app.use('*', createAuthenticationMiddleware(dependencies.accessTokenVerifier))
  registerListDogsRoute(app, dependencies.listDogs)
  registerCreateDogRoute(app, dependencies.createDog)
  registerGetDogRoute(app, dependencies.getDog)
  return app
}
