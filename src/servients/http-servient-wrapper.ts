/**
 * *****************************************************************************
 * Copyright (c) 2022 Contributors to the Eclipse Foundation
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0, or the W3C Software Notice and
 * Document License (2015-05-13) which is available at
 * https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document.
 *
 * SPDX-License-Identifier: EPL-2.0 OR W3C-20150513
 * ******************************************************************************
 *
 * @format
 */

import { Servient } from '@node-wot/core'
import { HttpServer } from '@node-wot/binding-http'
import ServientManager, { ServientWrapper } from './servient-manager'

export default class HttpServientWrapper implements ServientWrapper {
  private servient
  private userNodes = []
  private started = false
  private server
  private thing
  private nodeId
  public constructor(id: string, params: any) {
    console.log('***** servient constructor called', params)
    // create Servient add HTTP binding with port configuration
    this.servient = new Servient()
    this.server = new HttpServer({
      port: params.port // (default 8080)
    })
    this.servient.addServer(this.server)
    this.nodeId = id
  }
  public addUserNode(node) {
    console.log('*** addUserNode', node)
    const foundUserNodes = this.userNodes.filter(
      (userNode) => userNode.id === node.id
    )
    console.log('*** foundUserNodes.length', foundUserNodes.length)
    if (foundUserNodes.length === 0) {
      console.log('*** addUserNode executed')
      this.userNodes.push(node)
    }
  }
  public isRunning() {
    return this.started
  }

  public async startServient(
    title: string,
    description: string,
    userNodeIds: string[]
  ) {
    console.log('*** started', this.started)
    if (this.started === true) {
      // 起動状態であればservientを終わらせてfalseを返す
      return false
    }
    console.log('*** userNodeIds', userNodeIds)
    console.log('*** userNodes', this.userNodes)
    // 全てのユーザノードがそろっているか確認
    for (const id of userNodeIds) {
      let foundFlg = false
      for (const node of this.userNodes) {
        if (node.id === id) {
          foundFlg = true
        }
      }
      if (!foundFlg) {
        // ユーザノードに一致するノードが存在していなければfalseを返す
        console.log('*** foundFlg', foundFlg)
        return false
      }
    }
    // TDを作成
    let td = { title, description }
    for (const userNode of this.userNodes) {
      const props = userNode.getProps()
      console.log('*** props', props)
      td[props.attrType] = {
        ...td[props.attrType],
        [props.name]: props.content
      }
    }
    console.log('*** created td', td)
    const wot = await this.servient.start()
    this.thing = await wot.produce(td)
    console.log('*** thing', this.thing)
    // 処理を行うために対応するノードにメッセージ送信
    for (const userNode of this.userNodes) {
      const props = userNode.getProps()
      console.log('*** props', props)
      if (props.attrType === 'properties') {
        this.thing.setPropertyReadHandler(props.name, () => {
          console.log('*** call propertyReadHandler')
          console.log('*** userNodes.length', this.userNodes.length)
          return new Promise<any>((resolve, reject) => {
            const finish = (payload) => {
              console.log('*** finish', payload)
              resolve(payload)
            }
            userNode.send([
              {
                wot: { finish }
              },
              null
            ])
          })
        })
        if (!props.content.readOnly) {
          this.thing.setPropertyWriteHandler(props.name, async (value: any) => {
            const v = await value.value()
            console.log('*** call propertyWriteHandler', v)
            console.log('*** userNodes.length', this.userNodes.length)
            return new Promise<void>((resolve, reject) => {
              const finish = (payload) => {
                console.log('*** finish', props)
                if (props.content.observable) {
                  console.log('*** emitPropertyChange', props.name)
                  this.thing.emitPropertyChange(props.name)
                }
                resolve()
              }
              console.log('*** userNode', userNode)
              userNode.send([
                null,
                {
                  wot: { finish },
                  [props.outputAttr]: v
                }
              ])
            })
          })
        }
      } else if (props.attrType === 'actions') {
        //TODO: implements
      } else if (props.attrType === 'events') {
        //TODO: implements
      }
    }
    //TODO: このThingを、このConfigノードに関連するノードに渡して処理を追加する
    // 以下ダミー

    /*
    // init property value
    let count = 0

    console.log('Produced ' + thing.getThingDescription().title)

    // set property handlers (using async-await)
    thing.setPropertyReadHandler('count', async () => count)
    thing.setPropertyWriteHandler('count', async (intOutput) => {
      const value = await intOutput.value()
      if (typeof value === 'number') {
        count = value
      }
    })
    thing.setPropertyReadHandler('count2', async () => count + 1)
    thing.setPropertyWriteHandler('count2', async (intOutput) => {
      const value = await intOutput.value()
      if (typeof value === 'number') {
        count = value
      }
    })

    await thing.expose()
    console.info(thing.getThingDescription().title + ' ready')
    console.info('TD : ' + JSON.stringify(thing.getThingDescription()))
    */
    await this.thing.expose()
    this.started = true
    console.log('*** servient started')
    return true
  }
  public async endServient() {
    return new Promise<void>(async (resolve, reject) => {
      console.log('*** call endServient')
      this.userNodes = []
      ServientManager.getInstance().removeServientWrapper(this.nodeId)
      const timeoutId = setTimeout(() => {
        console.warn('timeout happend while servient ending.')
        this.started = false
        resolve()
      }, 3000) // 3秒経っても終わらなければ終了扱いとする
      if (this.server && this.thing) {
        console.log('*** call server.destroy')
        await this.server.destroy(this.thing.id)
        console.log('*** call server.stop')
        await this.server.stop()
        console.log('*** call servient.shutdown')
        await this.servient.shutdown()
      }
      console.log('*** servient finished')
      this.started = false
      clearTimeout(timeoutId)
      resolve()
    })
  }

  // プロパティ変更を通知
  public async emitPropertyChange(propertyName: string) {
    await this.thing.emitPropertyChange(propertyName)
  }

  // 新規に作成するConfigノードが競合するか調べる
  public isConflict(): boolean {
    throw new Error('Method not implemented.')
  }
}
