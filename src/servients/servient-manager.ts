import ServientWrapper from './servient-wrapper'

export default class ServientManager {
  private servientWrappers: { [key: string]: ServientWrapper } = {}
  private static instance: ServientManager
  public static getInstance(): ServientManager {
    if (!ServientManager.instance) {
      ServientManager.instance = new ServientManager()
    }
    return ServientManager.instance
  }
  private constructor() {
    console.debug('[debug] ServientManager constructor called.')
  }
  public createServientWrapper(id: string, bindingType: string, params: any): ServientWrapper {
    console.debug('[debug] createServientWrapper. ', id, bindingType, params)
    this.servientWrappers[id] = new ServientWrapper(bindingType, params)
    return this.servientWrappers[id]
  }
  public existServienetWrapper(id: string) {
    if (this.servientWrappers[id]) {
      return true
    }
    return false
  }
  public async removeServientWrapper(id: string) {
    console.debug('[debug] removeServientWrapper. id: ', id)
    await this.endServient(id)
    delete this.servientWrappers[id]
  }

  private async endServient(id: string) {
    return new Promise<void>(async (resolve, reject) => {
      console.debug('[debug] call endServient. id: ', id)
      const servientWrapper = this.servientWrappers[id]
      const timeoutId = setTimeout(() => {
        console.warn('[warn] timeout happend while servient ending.', id)
        resolve()
      }, 10000) // If it does not end after 10 seconds, it is considered to be finished.
      await servientWrapper.endServient()
      console.debug('[debug] servient ended. id: ', id)
      clearTimeout(timeoutId)
      resolve()
    })
  }

  public getThing(id: string, thingName: string) {
    const servientWrapper = this.servientWrappers[id]
    return servientWrapper?.getThing(thingName)
  }
}
