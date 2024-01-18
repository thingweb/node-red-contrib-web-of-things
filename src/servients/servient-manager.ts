import HttpServientWrapper from './http-servient-wrapper'

// servient type
export interface ServientWrapper {
  // Servientを作成できるか確認する
  isConflict(type: string, params: any): boolean
  createThing(td: any): Promise<any>
  exposeThing(): Promise<void>
  getThing(): any
  endServient(): Promise<void>
}

// servientのインスタンスを管理する
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
    console.log('*** ServientManager constructor called')
  }
  public createServientWrapper(id: string, bindingType: string, params: any): ServientWrapper {
    console.log('*** createServientWrapper', id, bindingType, params)
    if (!this.canCreateServient(bindingType, params)) {
      throw new Error(`servient wrapper conflicted. type: ${bindingType} params: ${JSON.stringify(params)}`)
    }
    if (bindingType === 'http') {
      this.servientWrappers[id] = new HttpServientWrapper(id, params)
    } else if (bindingType === 'coap') {
      //TODO
    }
    return this.servientWrappers[id]
  }
  public existServienetWrapper(id: string) {
    if (this.servientWrappers[id]) {
      return true
    }
    return false
  }
  private canCreateServient(type: string, params: any) {
    console.log('*** canCreateServient this.servientWrappers', this.servientWrappers)
    for (const id in this.servientWrappers) {
      if (this.servientWrappers[id].isConflict(type, params)) {
        return false
      }
    }
    return true
  }
  public async removeServientWrapper(id: string) {
    console.log('*** removeServientWrapper')
    this.endServient(id)
    delete this.servientWrappers[id]
  }

  private async endServient(id: string) {
    return new Promise<void>(async (resolve, reject) => {
      console.log('*** call endServient')
      const servientWrapper = this.servientWrappers[id]
      const timeoutId = setTimeout(() => {
        console.warn('timeout happend while servient ending.')
        delete this.servientWrappers[id]
        resolve()
      }, 3000) // 3秒経っても終わらなければ終了扱いとする
      servientWrapper.endServient()
      console.log('*** servient finished')
      delete this.servientWrappers[id]
      clearTimeout(timeoutId)
      resolve()
    })
  }

  public getThing(id: string) {
    const servientWrapper = this.servientWrappers[id]
    return servientWrapper?.getThing()
  }
}
