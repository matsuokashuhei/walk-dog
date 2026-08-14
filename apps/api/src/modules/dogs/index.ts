export type {
  CreateDog,
  CreateDogInput,
  CurrentGoal,
  Dog,
  GetDog,
  ListDogs,
} from './types.js'
export type { DogRepository } from './repository.js'
export { DogNameDuplicateError } from './errors.js'
export {
  registerDogRoutes,
  type DogRouteDependencies,
} from './routes/index.js'
