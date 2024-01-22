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
 * ******************************************************************************/

import { ExposedThing, Servient } from '@node-wot/core'
import { HttpServer } from '@node-wot/binding-http'
import { CoapServer } from '@node-wot/binding-coap'
import { WebSocketServer } from '@node-wot/binding-websockets'
import { MqttBrokerServer } from '@node-wot/binding-mqtt'

export default class ServientWrapper {
  private servient
  private wot
  private started = false
  private server
  private things: { [key: string]: ExposedThing } = {}
  public constructor(bindingType: string, config: any) {
    console.log('***** servient constructor called', config)
    // create Servient add HTTP binding with port configuration
    this.servient = new Servient()
    if (bindingType === 'http') {
      this.server = new HttpServer(config)
    } else if (bindingType === 'websocket') {
      this.server = new WebSocketServer(config)
    } else if (bindingType === 'coap') {
      this.server = new CoapServer(config)
    } else if (bindingType === 'mqtt') {
      this.server = new MqttBrokerServer(config)
    }
    this.servient.addServer(this.server)
  }

  public isRunning() {
    return this.started
  }

  public async startServient() {
    this.wot = await this.servient.start()
    console.log('*** wot in startServient', this.wot)
  }

  public async createThing(td, thingName: string) {
    console.log('*** wot in createThing', this.wot)
    const thing = await this.wot.produce(td)
    this.things[thingName] = thing
    return thing
  }

  public async exposeThing(thing: ExposedThing) {
    await thing.expose()
    this.started = true
    const td = thing.getThingDescription()
    console.log('*** exposed', td)
    return td
  }

  public getThing(thingName: string) {
    return this.things[thingName]
  }

  public async endServient() {
    if (this.server) {
      console.log('*** call server.destroy')
      for (const key in this.things) {
        await this.server.destroy(this.things[key].id)
      }
      console.log('*** call server.stop')
      await this.server.stop()
      console.log('*** call servient.shutdown')
      await this.servient.shutdown()
    }
  }
}
