/**
 * Repository interface
 *
 * All storage adapters must implement these methods.
 * Every method is async so HTTP-based adapters work without changing call sites.
 *
 * Adapters live in ./adapters/ and are selected in ./index.js.
 */

/**
 * @typedef {Object} Config
 * @property {Object} brand
 * @property {Object} materials
 * @property {Object} isoClasses
 * @property {Object} geometries
 * @property {Object} depths
 * @property {Object} machines
 */

/**
 * @typedef {Object} IRepository
 * @property {() => Promise<Config>}         getConfig
 * @property {(config: Config) => Promise<void>} saveConfig
 * @property {(section: string, data: any) => Promise<void>} saveSection
 * @property {() => Promise<void>}           resetConfig
 */

/**
 * Base class — throws on every method so missing implementations are caught early.
 */
export class BaseRepository {
  async getConfig()                   { throw new Error("getConfig() not implemented") }
  async saveConfig(_config)           { throw new Error("saveConfig() not implemented") }
  async saveSection(_section, _data)  { throw new Error("saveSection() not implemented") }
  async resetConfig()                 { throw new Error("resetConfig() not implemented") }
}
