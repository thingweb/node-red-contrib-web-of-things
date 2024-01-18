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

import { Servient } from '@node-wot/core'
import { HttpServer } from '@node-wot/binding-http'
import { ServientWrapper } from './servient-manager'

export default class HttpServientWrapper implements ServientWrapper {
  private servient
  private started = false
  private server
  private thing
  public constructor(id: string, params: any) {
    console.log('***** servient constructor called', params)
    // create Servient add HTTP binding with port configuration
    this.servient = new Servient()
    this.server = new HttpServer({
      port: params.port, // (default 8080)
    })
    this.servient.addServer(this.server)
  }

  public isRunning() {
    return this.started
  }

  public async createThing(td) {
    const wot = await this.servient.start()
    this.thing = await wot.produce(td)
    return this.thing
  }

  public async exposeThing() {
    await this.thing.expose()
    this.started = true
    console.log('*** exposed')
  }

  public getThing() {
    return this.thing
  }

  public async endServient() {
    if (this.server && this.thing) {
      console.log('*** call server.destroy')
      await this.server.destroy(this.thing.id)
      console.log('*** call server.stop')
      await this.server.stop()
      console.log('*** call servient.shutdown')
      await this.servient.shutdown()
    }
  }

  // 新規に作成するConfigノードが競合するか調べる
  public isConflict(): boolean {
    //TODO: 実装
    return false
    throw new Error('Method not implemented.')
  }
}
