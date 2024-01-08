/** @format */

import HttpServientWrapper from './http-servient-wrapper'

// servient type
export interface ServientWrapper {
  // Servientを作成できるか確認する
  isConflict(type: string, params: any): boolean
  addUserNode(node: any): void
  startServient(
    title: string,
    description: string,
    userNodeIds: string[]
  ): Promise<boolean>
  endServient(): Promise<void>
  emitPropertyChange(propertyName: string): Promise<void>
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
  public createServientWrapper(
    id: string,
    type: string,
    params: any
  ): ServientWrapper {
    console.log('*** createServientWrapper', id, type, params)
    if (!this.canCreateServient(type, params)) {
      throw new Error(
        `servient wrapper conflicted. type: ${type} params: ${JSON.stringify(
          params
        )}`
      )
    }
    if (type === 'http') {
      this.servientWrappers[id] = new HttpServientWrapper(id, params)
    } else if (type === 'coap') {
      //TODO
    }
    return this.servientWrappers[id]
  }
  public getServientWrapper(id: string): ServientWrapper {
    console.log('*** getServientWrapper', id)
    console.log('*** this.servientWrappers', this.servientWrappers)
    return this.servientWrappers[id]
  }
  public canCreateServient(type: string, params: any) {
    console.log(
      '*** canCreateServient this.servientWrappers',
      this.servientWrappers
    )
    for (const id in this.servientWrappers) {
      if (this.servientWrappers[id].isConflict(type, params)) {
        return false
      }
    }
    return true
  }
  public removeServientWrapper(id: string) {
    console.log('*** removeServientWrapper')
    delete this.servientWrappers[id]
  }
}
