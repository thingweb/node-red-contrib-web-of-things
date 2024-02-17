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
    console.debug('[debug] servient constructor called. config: ', config)
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
  }

  public async createThing(td) {
    const thing = await this.wot.produce(td)
    this.things[td.title] = thing
    return thing
  }

  public async exposeThing(thing: ExposedThing) {
    await thing.expose()
    this.started = true
    const td = thing.getThingDescription()
    console.debug('[debug] thing exposed.', td)
    return td
  }

  public getThing(thingName: string) {
    return this.things[thingName]
  }

  public async endServient() {
    if (this.server) {
      console.debug('[debug] endServient called.')
      for (const key in this.things) {
        await this.server.destroy(this.things[key].id)
      }
      console.debug('[debug] server destroyed.')
      await this.server.stop()
      console.debug('[debug] server stopped.')
      await this.servient.shutdown()
      console.debug('[debug] servient shutdown.')
    }
  }
}
