/*
* @adonisjs/lucid
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

/// <reference path="../adonis-typings/database.ts" />

import * as test from 'japa'
import { MysqlConfigContract } from '@ioc:Adonis/Addons/Database'

import { getConfig, setup, cleanup } from '../test-helpers'
import { Connection } from '../src/Connection'

test.group('Connection', (group) => {
  group.before(async () => {
    await setup()
  })

  group.after(async () => {
    await cleanup()
  })

  test('do not instantiate knex unless connect is called', (assert) => {
    const connection = new Connection('primary', getConfig())
    assert.isUndefined(connection.client)
  })

  test('instantiate knex when connect is invoked', async (assert, done) => {
    const connection = new Connection('primary', getConfig())
    connection.on('connect', () => {
      assert.isDefined(connection.client)
      assert.equal(connection.pool!.numUsed(), 0)
      done()
    })

    connection.connect()
  })

  test('on disconnect destroy knex', async (assert) => {
    const connection = new Connection('primary', getConfig())
    connection.connect()
    await connection.disconnect()
    assert.isUndefined(connection.client)
  })

  test('destroy connection when pool min resources are zero and connection is idle', async (assert, done) => {
    const connection = new Connection('primary', Object.assign(getConfig(), {
      pool: {
        min: 0,
        idleTimeoutMillis: 10,
      },
    }))

    connection.connect()
    await connection.client!.raw('select 1+1 as result')

    connection.on('disconnect', () => {
      assert.isUndefined(connection.client)
      done()
    })
  })

  test('on disconnect emit disconnect event', async (assert, done) => {
    const connection = new Connection('primary', getConfig())
    connection.connect()

    connection.on('disconnect', () => {
      assert.isUndefined(connection.client)
      done()
    })

    await connection.disconnect()
  })

  test('raise error when unable to make connection', (assert) => {
    const connection = new Connection('primary', Object.assign({}, getConfig(), { client: null }))

    const fn = () => connection.connect()
    assert.throw(fn, /knex: Required configuration option/)
  })
})

if (process.env.DB === 'mysql') {
  test.group('Connection | mysql', () => {
    test('pass user config to mysql driver', async (assert) => {
      const config = getConfig() as MysqlConfigContract
      config.connection.charset = 'utf-8'
      config.connection.typeCast = false

      const connection = new Connection('primary', config)
      connection.connect()

      assert.equal(connection.client!['_context'].client.constructor.name, 'Client_MySQL')
      assert.equal(connection.client!['_context'].client.config.connection.charset, 'utf-8')
      assert.equal(connection.client!['_context'].client.config.connection.typeCast, false)
    })
  })
}