import Statechart from 'dummy/utils/statechart';
import { module, test } from 'qunit';

module('Unit | Utility | statechart', function (/*hooks*/) {
  module('#send', function () {
    test('state event handlers can transition to other states of the statechart when calling `send`', async function (assert) {
      let statechart = new Statechart({
        initial: 'new',
        states: {
          new: {
            on: {
              woot: 'next',
            },
          },
          next: {},
        },
      });

      assert.equal(
        statechart.currentState.value,
        'new',
        'initial state was setup correctly'
      );

      statechart.send('woot');

      assert.equal(
        statechart.currentState.value,
        'next',
        'successfully transitioned into the new state'
      );
    });

    test('transition to different states can be handled by actions', async function (assert) {
      let statechart = new Statechart(
        {
          initial: 'new',
          states: {
            new: {
              on: {
                woot: {
                  target: 'next',
                  actions: [
                    () => {
                      assert.step('inlineAction');
                    },
                    'wat',
                  ],
                },
              },
            },
            next: {},
          },
        },
        {
          actions: {
            wat() {
              assert.step('wat');
            },
          },
        }
      );

      statechart.send('woot');

      assert.verifySteps(
        ['inlineAction', 'wat'],
        'functions as actions will not be ignored'
      );
    });

    module('sending event data', function () {
      test('it is possible to pass data when sending events', async function (assert) {
        assert.expect(1);

        const testData = {
          name: 'Tomster',
        };

        let statechart = new Statechart(
          {
            initial: 'new',
            states: {
              new: {
                on: {
                  woot: {
                    target: 'next',
                    actions: ['wat'],
                  },
                },
              },
              next: {},
            },
          },
          {
            actions: {
              // eslint-disable-next-line no-unused-vars
              wat(_context, { type, ...data }) {
                assert.deepEqual(data, testData, 'data was passed as expected');
              },
            },
          }
        );

        statechart.send('woot', testData);
      });

      test('it is possible to pass an xstate event-object directly', async function (assert) {
        assert.expect(1);
        const testData = {
          name: 'Tomster',
        };

        let statechart = new Statechart(
          {
            initial: 'new',
            states: {
              new: {
                on: {
                  woot: {
                    target: 'next',
                    actions: ['wat'],
                  },
                },
              },
              next: {},
            },
          },
          {
            actions: {
              // eslint-disable-next-line no-unused-vars
              wat(_context, { type, ...data }) {
                assert.deepEqual(data, testData, 'data was passed as expected');
              },
            },
          }
        );

        const eventObject = { type: 'woot', ...testData };

        statechart.send(eventObject);
      });

      test('if sent data contains a type property a warning is issued', async function (assert) {
        assert.expect(3);

        const testData = {
          name: 'Tomster',
          type: 'trolol',
        };

        let statechart = new Statechart(
          {
            initial: 'new',
            states: {
              new: {
                on: {
                  woot: {
                    target: 'next',
                    actions: ['wat'],
                  },
                },
              },
              next: {},
            },
          },
          {
            actions: {
              wat(_context, { type, ...data }) {
                assert.equal(
                  type,
                  'woot',
                  'overriding of `type` does not work'
                );
                assert.deepEqual(
                  data,
                  { name: 'Tomster' },
                  'data was passed as expected'
                );
                assert.expectWarning(
                  `You passed property \`type\` as part of the data you sent with the event \`woot\` . This is not supported - \`woot\` will be used as event name.`
                );
              },
            },
          }
        );

        statechart.send('woot', testData);
      });
    });

    test('transition to different states can be handled by multiple actions in sequence', async function (assert) {
      let statechart = new Statechart(
        {
          initial: 'new',
          states: {
            new: {
              on: {
                woot: {
                  target: 'next',
                  actions: ['wat', 'yo'],
                },
              },
            },
            next: {},
          },
        },
        {
          actions: {
            wat() {
              assert.step('actionA');
            },
            yo() {
              assert.step('actionB');
            },
          },
        }
      );

      statechart.send('woot');

      assert.verifySteps(
        ['actionA', 'actionB'],
        'actions fire in the correct order'
      );
    });

    test('when specifying multiple actions all actions will be passed the event data', async function (assert) {
      assert.expect(5);

      const testData = {
        name: 'Tomster',
      };

      let statechart = new Statechart(
        {
          initial: 'new',
          states: {
            new: {
              on: {
                woot: {
                  target: 'next',
                  actions: ['wat', 'yo'],
                },
              },
            },
            next: {},
          },
        },
        {
          actions: {
            // eslint-disable-next-line no-unused-vars
            wat(_context, { type, ...data }) {
              assert.deepEqual(
                data,
                testData,
                'actionA got passed correct data'
              );
              assert.step('actionA');
            },
            // eslint-disable-next-line no-unused-vars
            yo(_context, { type, ...data }) {
              assert.deepEqual(
                data,
                testData,
                'actionB got passed correct data'
              );
              assert.step('actionB');
            },
          },
        }
      );

      statechart.send('woot', testData);

      assert.verifySteps(
        ['actionA', 'actionB'],
        'actions fire in the correct order'
      );
    });

    test('if the currentState does not implement the sent event it does not break', async function (assert) {
      let statechart = new Statechart({
        initial: 'new',
        states: {
          new: {},
        },
      });

      statechart.send('wat');

      assert.equal(statechart.currentState.value, 'new');
    });

    test("when a new state is entered the old state's `exit` function will be called and after that the newState's `entry` function`", async function (assert) {
      assert.expect(6);

      let someData = { woot: 'lol' };

      let statechart = new Statechart({
        initial: 'new',
        states: {
          new: {
            on: {
              woot: 'next',
            },
            // eslint-disable-next-line no-unused-vars
            exit(_context, { type, ...data }) {
              assert.step('exitState');
              assert.deepEqual(
                data,
                someData,
                'states can pass data when they transition'
              );
            },
          },
          next: {
            // eslint-disable-next-line no-unused-vars
            entry(context, { type, ...data }) {
              assert.step('enterState');
              assert.deepEqual(
                data,
                someData,
                'states can pass data when they transition'
              );
            },
          },
        },
      });

      statechart.send('woot', someData);

      assert.equal(
        statechart.currentState.value,
        'next',
        'entered correct state'
      );
      assert.verifySteps(
        ['exitState', 'enterState'],
        'exit and enter functions called in right order'
      );
    });

    test('StateCharts can be passed a context that the states have access to in their actions', async function (assert) {
      assert.expect(1);
      let testContext = {
        name: 'test context',
      };

      let statechart = new Statechart(
        {
          initial: 'new',
          states: {
            new: {
              on: {
                woot: {
                  target: 'next',
                  actions: ['test'],
                },
              },
            },
            next: {},
          },
        },
        {
          actions: {
            test(context) {
              assert.deepEqual(
                context,
                testContext,
                'context is accessible in action handlers'
              );
            },
          },
        },
        testContext
      );

      statechart.send('woot');
    });

    test('Statecharts can implement guards to determine if a transition should occur between states', async function (assert) {
      assert.expect(6);

      let testData = {
        name: 'Tomster',
      };

      let testContext = {
        name: 'test context',
      };

      let statechart = new Statechart(
        {
          initial: 'new',
          context: testContext,
          states: {
            new: {
              on: {
                woot: {
                  target: 'next',
                  cond: (context, eventObject) => {
                    let { type, ...data } = eventObject;
                    assert.equal(
                      type,
                      'woot',
                      'eventName is accessible in condition'
                    );
                    assert.deepEqual(
                      data,
                      testData,
                      'passed event data is available in condition'
                    );
                    assert.deepEqual(
                      context,
                      testContext,
                      "the statechart's context is available in condition"
                    );

                    return false;
                  },
                  actions: ['wootAction'],
                },
                foo: {
                  target: 'next',
                  cond: () => {
                    return true;
                  },
                  actions: ['fooAction'],
                },
              },
            },
            next: {},
          },
        },
        {
          actions: {
            wootAction() {
              assert.ok(
                false,
                "no action will be called as we won't transition because of `woot`-event"
              );
            },
            fooAction() {
              assert.ok(
                true,
                'returning `true` from a condition will trigger a transition'
              );
            },
          },
        }
      );

      statechart.send('woot', testData);

      assert.equal(
        statechart.currentState.value,
        'new',
        'woot did not trigger a transition'
      );

      statechart.send('foo', testData);

      assert.equal(
        statechart.currentState.value,
        'next',
        'foo did trigger a transition'
      );
    });

    test('guards can be used to conditionally transition into different states based on the same event', async function (assert) {
      const testContext = {
        power: 1,
      };

      const statechart = new Statechart({
        context: testContext,
        initial: 'fighting',
        states: {
          fighting: {
            on: {
              strike: [
                {
                  target: 'won',
                  cond(extendedState) {
                    return extendedState.power > 9000;
                  },
                },
                {
                  target: 'fighting',
                },
              ],
            },
          },
          won: {},
        },
      });

      statechart.send('strike');

      assert.equal(
        statechart.currentState.value,
        'fighting',
        'transition did not happen because of condition'
      );

      testContext.power = 9001;

      statechart.send('strike');

      assert.equal(
        statechart.currentState.value,
        'won',
        'transition did happen because power is now over 9000'
      );
    });

    test('it supports strings as guard conditions', async function (assert) {
      assert.expect(5);

      let testContext = {
        name: 'Tomster',
      };

      let testData = {
        canTransition: true,
      };

      let statechart = new Statechart(
        {
          context: testContext,
          initial: 'powerOff',
          states: {
            powerOff: {
              on: {
                power: {
                  target: 'powerOn',
                  cond: 'canTransition',
                },
              },
            },
            powerOn: {},
          },
        },
        {
          guards: {
            canTransition: (extendedState, eventObject) => {
              assert.equal(
                extendedState.name,
                'Tomster',
                'machine guard functions can access the statecharts context'
              );

              let { type, ...eventData } = eventObject;

              assert.equal(
                type,
                'power',
                'eventObject contains name of event that was sent'
              );
              assert.deepEqual(
                eventData,
                testData,
                'data passed to event is available in guards'
              );

              return eventData.canTransition;
            },
          },
        }
      );

      assert.equal(statechart.currentState.value, 'powerOff');

      statechart.send('power', testData);

      assert.equal(statechart.currentState.value, 'powerOn');
    });
  });

  module('nesting', function () {
    test('StateCharts can be nested', async function (assert) {
      let statechart = new Statechart({
        initial: 'off',
        states: {
          off: {
            on: {
              power: 'on',
            },
          },
          on: {
            initial: 'stopped',
            states: {
              stopped: {},
              playing: {},
              paused: {},
            },
          },
        },
      });

      assert.equal(statechart.currentState.value, 'off');

      statechart.send('power');

      assert.deepEqual(
        statechart.currentState.value,
        { on: 'stopped' },
        'nested states will return an object as their `value`'
      );
    });

    test('Statechart transitions in nested states work', async function (assert) {
      assert.expect(3);

      let statechart = new Statechart({
        initial: 'on',
        states: {
          off: {
            on: {
              power: 'on',
            },
          },
          on: {
            initial: 'stopped',
            states: {
              stopped: {
                on: {
                  play: 'playing',
                },
              },
              playing: {},
              paused: {},
            },
            on: {
              power: 'off',
            },
          },
        },
      });

      assert.deepEqual(statechart.currentState.value, { on: 'stopped' });

      statechart.send('play');

      assert.deepEqual(statechart.currentState.value, { on: 'playing' });

      statechart.send('power');

      assert.deepEqual(statechart.currentState.value, 'off');
    });
    test('nested statecharts have access to the top-level context object', async function (assert) {
      assert.expect(8);

      let testContext = {
        name: 'lol',
      };

      let statechart = new Statechart(
        {
          initial: 'off',
          context: testContext,

          states: {
            off: {
              on: {
                power: 'on',
              },
            },
            on: {
              initial: 'stopped',
              states: {
                stopped: {
                  entry(context) {
                    assert.deepEqual(
                      context,
                      testContext,
                      'context is available as expected'
                    );
                  },
                  exit(context) {
                    assert.equal(context.name, 'lol');
                  },
                  on: {
                    play: {
                      target: 'playing',
                      actions: ['testTestContext'],
                    },
                  },
                },
                playing: {},
                paused: {},
              },
              on: {
                power: {
                  target: 'off',
                  actions: ['testTestContext'],
                },
              },
            },
          },
        },
        {
          actions: {
            testTestContext(context) {
              assert.deepEqual(context, testContext);
            },
          },
        }
      );

      assert.equal(statechart.currentState.value, 'off');

      statechart.send('power');

      assert.deepEqual(statechart.currentState.value, { on: 'stopped' });

      statechart.send('play');

      assert.deepEqual(statechart.currentState.value, { on: 'playing' });

      statechart.send('power');

      assert.equal(statechart.currentState.value, 'off');
    });

    test('nested statecharts will execute entry handlers for the chart first and then for the initial state of the nested chart', async function (assert) {
      assert.expect(7);

      let testData = {
        wat: 'lol',
      };

      let statechart = new Statechart({
        initial: 'off',

        states: {
          off: {
            on: {
              power: 'on',
            },
          },
          on: {
            initial: 'stopped',
            states: {
              stopped: {
                // eslint-disable-next-line no-unused-vars
                entry(context, { type, ...data }) {
                  assert.deepEqual(
                    data,
                    testData,
                    'data passed via send will be available in substates as well'
                  );
                  assert.step('stopped');
                },
              },
              playing: {
                entry() {
                  assert.step('wat');
                },
              },
            },
            // eslint-disable-next-line no-unused-vars
            entry(context, { type, ...data }) {
              assert.deepEqual(
                data,
                testData,
                'data passed from goToState wil be available in enterState'
              );
              assert.step('on');
            },
          },
        },
      });

      assert.equal(statechart.currentState.value, 'off');

      statechart.send('power', testData);

      assert.deepEqual(statechart.currentState.value, { on: 'stopped' });
      assert.verifySteps(['on', 'stopped']);
    });

    test('nested statecharts will execute exitState handlers for substate first and then for the chart', async function (assert) {
      let statechart = new Statechart({
        initial: 'on',

        states: {
          off: {},
          on: {
            initial: 'stopped',
            states: {
              stopped: {
                exit() {
                  assert.step('stopped');
                },
              },
              playing: {
                exit() {
                  assert.step('wat');
                },
              },
            },
            exit() {
              assert.step('on');
            },
            on: {
              power: 'off',
            },
          },
        },
      });

      statechart.send('power');

      assert.equal(statechart.currentState.value, 'off');
      assert.verifySteps(['stopped', 'on']);
    });

    test('when exiting a nested states and entering again we will start out in the default initial state again', async function (assert) {
      let statechart = new Statechart({
        initial: 'on',
        states: {
          off: {
            on: {
              power: 'on',
            },
          },
          on: {
            initial: 'stopped',
            states: {
              stopped: {
                on: {
                  play: 'playing',
                },
              },
              playing: {},
            },
            on: {
              power: 'off',
            },
          },
        },
      });

      assert.deepEqual(statechart.currentState.value, { on: 'stopped' });

      statechart.send('play');

      assert.deepEqual(statechart.currentState.value, { on: 'playing' });

      statechart.send('power');

      assert.equal(statechart.currentState.value, 'off');

      statechart.send('power');

      assert.deepEqual(statechart.currentState.value, { on: 'stopped' });
    });

    test('statecharts can be nested multiple levels deep', async function (assert) {
      let statechart = new Statechart({
        initial: 'a',
        states: {
          a: {
            initial: 'aa',
            states: {
              aa: {
                initial: 'aaa',
                states: {
                  aaa: {
                    initial: 'aaaa',
                    states: {
                      aaaa: {
                        on: {
                          aaab: 'aaab',
                        },
                      },
                      aaab: {},
                    },
                  },
                  aab: {},
                },
                on: {
                  ab: 'ab',
                },
              },
              ab: {},
            },
          },
        },
      });

      assert.deepEqual(statechart.currentState.value, {
        a: {
          aa: {
            aaa: 'aaaa',
          },
        },
      });

      statechart.send('aaab');

      assert.deepEqual(statechart.currentState.value, {
        a: {
          aa: {
            aaa: 'aaab',
          },
        },
      });

      statechart.send('ab');

      assert.deepEqual(statechart.currentState.value, {
        a: 'ab',
      });
    });

    test('statecharts can have orthogonal states', async function (assert) {
      assert.expect(10);

      let testContext = {
        name: 'wat',
      };

      let testData = {
        message: 'success!',
      };

      let statechart = new Statechart(
        {
          context: testContext,
          type: 'parallel',
          states: {
            upload: {
              initial: 'idle',
              states: {
                idle: {
                  on: {
                    INIT_UPLOAD: 'pending',
                  },
                },
                pending: {
                  on: {
                    UPLOAD_COMPLETE: {
                      target: 'success',
                      actions: ['handleUploadSuccess'],
                    },
                  },
                },
                success: {},
              },
            },
            download: {
              initial: 'idle',
              states: {
                idle: {
                  on: {
                    INIT_DOWNLOAD: {
                      target: 'pending',
                      actions: ['handleInitDownload'],
                    },
                  },
                },
                pending: {
                  // eslint-disable-next-line no-unused-vars
                  entry(context, { type, ...data }) {
                    assert.deepEqual(data, testData, 'passing data works');
                    assert.deepEqual(
                      context,
                      testContext,
                      'context is passed as expected'
                    );
                  },
                  on: {
                    DOWNLOAD_COMPLETE: 'success',
                  },
                },
                success: {},
              },
            },
          },
        },
        {
          actions: {
            // eslint-disable-next-line no-unused-vars
            handleUploadSuccess(context, { type, ...data }) {
              assert.deepEqual(data, testData, 'passing data works');
              assert.deepEqual(
                context,
                testContext,
                'context is passed as expected'
              );
            },
            // eslint-disable-next-line no-unused-vars
            handleInitDownload(context, { type, ...data }) {
              assert.deepEqual(data, testData, 'passing data works');
              assert.deepEqual(context, testContext, 'context is passed');
            },
          },
        }
      );

      assert.deepEqual(
        statechart.currentState.value,
        {
          upload: 'idle',
          download: 'idle',
        },
        'parallel/orthogonal states work as expected'
      );

      statechart.send('INIT_UPLOAD');

      assert.deepEqual(
        statechart.currentState.value,
        {
          upload: 'pending',
          download: 'idle',
        },
        'parallel states can handle events'
      );

      statechart.send('INIT_DOWNLOAD', testData);

      assert.deepEqual(
        statechart.currentState.value,
        {
          upload: 'pending',
          download: 'pending',
        },
        'second parallel state can handle events'
      );

      statechart.send('UPLOAD_COMPLETE', testData);

      assert.deepEqual(
        statechart.currentState.value,
        {
          upload: 'success',
          download: 'pending',
        },
        'parallel states have expected end states'
      );
    });
  });
});
