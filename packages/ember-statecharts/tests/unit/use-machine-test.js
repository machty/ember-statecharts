import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, clearRender, click, waitUntil } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { Machine, actions, createMachine } from 'xstate';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { setComponentTemplate } from '@ember/component';
import { matchesState, useMachine } from 'ember-statecharts';
import { ARGS_STATE_CHANGE_WARNING } from 'ember-statecharts/-private/usables';

module('Unit | use-machine', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    const TestMachineConfig = {
      initial: 'stopped',
      states: {
        stopped: {
          on: {
            START: {
              target: 'started',
              actions: ['lol'],
            },
          },
        },
        started: {
          on: {
            STOP: 'stopped',
          },
        },
      },
    };

    const TestMachine = Machine(TestMachineConfig, {
      actions: {
        lol() {},
      },
    });

    const CreatedTestMachine = createMachine(TestMachineConfig, {
      actions: {
        lol() {},
      },
    });

    this.set('TestMachine', TestMachine);
    this.set('TestMachineConfig', TestMachineConfig);
    this.set('CreatedTestMachine', CreatedTestMachine);
  });

  module('it is possible to work with `useMachine`', function () {
    test('passing a machine created with `Machine` works', async function (assert) {
      assert.expect(5);

      const testContext = this;

      const { TestMachine } = this;

      class Test extends Component {
        statechart = useMachine(this, () => {
          return {
            machine: TestMachine.withConfig({
              actions: {
                lol(context) {
                  assert.equal(
                    context.name,
                    'Tomster',
                    'context was updated as expected'
                  );
                  assert.step('patched');
                },
              },
            }).withContext({
              name: this.name,
            }),
          };
        });

        constructor(owner, args) {
          super(owner, args);

          testContext.test = this;

          this.name = 'Tomster';
        }
      }

      this.owner.register('component:test', Test);

      await render(hbs`
        <Test />
      `);

      assert.equal(
        testContext.test.statechart.state.value,
        'stopped',
        'statechart state is accessible'
      );

      testContext.test.statechart.send('START');

      assert.equal(
        testContext.test.statechart.state.value,
        'started',
        'statechart state updated'
      );

      assert.verifySteps(['patched'], 'config can be updated via `@use`');
    });

    // TODO changelog to say that passing a config doesn't work

    test('passing a machine created via `createMachine` works', async function (assert) {
      assert.expect(5);

      const testContext = this;

      const { CreatedTestMachine } = this;

      class Test extends Component {
        statechart = useMachine(this, () => {
          return {
            machine: CreatedTestMachine.withConfig({
              actions: {
                lol(context) {
                  assert.equal(
                    context.name,
                    'Tomster',
                    'context was updated as expected'
                  );
                  assert.step('patched');
                },
              },
            }).withContext({
              name: this.name,
            }),
          };
        });

        constructor(owner, args) {
          super(owner, args);

          testContext.test = this;

          this.name = 'Tomster';
        }
      }

      this.owner.register('component:test', Test);

      await render(hbs`
    <Test />
    `);

      assert.equal(
        testContext.test.statechart.state.value,
        'stopped',
        'statechart state is accessible'
      );

      testContext.test.statechart.send('START');

      assert.equal(
        testContext.test.statechart.state.value,
        'started',
        'statechart state updated'
      );

      assert.verifySteps(['patched'], 'config can be updated via `@use`');
    });

    test('passing `interpreterOptions` works', async function (assert) {
      class Test extends Component {
        statechart = useMachine(this, () => {
          return {
            machine: Machine({
              initial: 'idle',
              states: {
                idle: {
                  entry: actions.log('Custom logger called'),
                },
              },
            }),
            interpreterOptions: {
              logger: (string) => assert.step(string),
            },
          };
        });

        constructor(owner, args) {
          super(owner, args);

          // access usable to setup usable
          this.statechart.state;
        }
      }

      this.owner.register('component:test', Test);

      await render(hbs`
    <Test />
    `);

      assert.verifySteps(['Custom logger called'], 'Custom logger was called');
    });

    test('interpreted machine service is stopped when component is torn down', async function (assert) {
      const testContext = this;
      const { TestMachine } = this;

      class Test extends Component {
        statechart = useMachine(this, () => {
          return {
            machine: TestMachine,
          };
        });
        constructor(owner, args) {
          super(owner, args);

          testContext.test = this;
        }
      }

      this.owner.register('component:test', Test);

      await render(hbs`
    <Test />
    `);

      const service = testContext.test.statechart.service;

      service.onStop(function () {
        assert.step('service stopped');
      });

      assert.verifySteps([], 'service was not stopped');

      await clearRender();

      assert.verifySteps(['service stopped'], 'service was stopped');
    });

    module(
      'when args and local state passed to `useMachine` change',
      function (hooks) {
        hooks.beforeEach(function () {
          const testContext = this;

          class Test extends Component {
            @tracked name;

            statechart = useMachine(this, () => {
              return {
                machine: this.args.machine
                  .withConfig({
                    actions: {
                      lol: this.args.lol,
                    },
                  })
                  .withContext({
                    name: this.name,
                  }),
              };
            });

            constructor(owner, args) {
              super(owner, args);

              testContext.test = this;

              this.name = 'Tomster';
            }
          }

          const testTemplate = hbs`
            <div>{{this.statechart.state.value}}</div>
          `;

          setComponentTemplate(testTemplate, Test);

          this.owner.register('component:test', Test);
        });

        test('interpreted machine service does not get resetup when args change', async function (assert) {
          const testContext = this;

          const { TestMachine, CreatedTestMachine } = this;

          this.set('lol', function () {});
          this.set('machine', TestMachine);

          await render(hbs`
            <Test @lol={{this.lol}} @machine={{this.machine}}/>
          `);

          const service = testContext.test.statechart.service;

          testContext.test.name = 'Zoey';

          assert.deepEqual(
            service,
            testContext.test.statechart.service,
            'service was not resetup after local component state used in `useMachine#withContext` was changed'
          );

          this.set('lol', function () {});

          assert.deepEqual(
            service,
            testContext.test.statechart.service,
            'service was not resetup after args used in `useMachine#withConfig` were changed'
          );

          this.set('machine', CreatedTestMachine);

          assert.deepEqual(
            service,
            testContext.test.statechart.service,
            'service was not resetup after component args used in @use were changed'
          );
        });

        test('when args or local state passed to `useMachine` is changed a warning is issued', async function (assert) {
          const { TestMachine, CreatedTestMachine } = this;

          this.set('lol', function () {});
          this.set('machine', TestMachine);

          await render(hbs`
            <Test @lol={{this.lol}} @machine={{this.machine}}/>
          `);

          // local state change
          this.set('test.name', 'Zoey');

          assert.expectWarning(
            ARGS_STATE_CHANGE_WARNING,
            'warning was issued based on local state change'
          );

          // args change `withConfig`
          this.set('lol', function () {});

          assert.expectWarning(
            ARGS_STATE_CHANGE_WARNING,
            'warning was issued based on args change used in `withConfig`'
          );

          // args change `useMachine`
          this.set('machine', CreatedTestMachine);

          assert.expectWarning(
            ARGS_STATE_CHANGE_WARNING,
            'warning was issued based on args change'
          );
        });
      }
    );

    module("xstate's built-in assign works as expected", function (hooks) {
      hooks.beforeEach(function () {
        this.counterMachine = Machine({
          initial: 'active',
          states: {
            active: {
              on: {
                INCREMENT: {
                  actions: 'increment',
                },
                DECREMENT: {
                  actions: 'decrement',
                },
              },
            },
          },
        });

        this.counterTemplate = hbs`
        <div data-test-count={{this.statechart.state.context.count}}>
          Count: {{this.statechart.state.context.count}}
        </div>
        <button type="button" data-test-plus {{on "click" this.plusClicked}}>
          +
        </button>
        <button type="button" data-test-minus {{on "click" this.minusClicked}}>
          -
        </button>
        `;
      });

      test('it is possible to use `assign` with an object', async function (assert) {
        const { counterMachine } = this;

        class Counter extends Component {
          statechart = useMachine(this, () => {
            return {
              machine: counterMachine
                .withContext({
                  count: 0,
                })
                .withConfig({
                  actions: {
                    increment: actions.assign({
                      count: (context) => context.count + 1,
                    }),
                    decrement: actions.assign({
                      count: (context) => context.count - 1,
                    }),
                  },
                }),
            };
          });

          @action
          plusClicked() {
            this.statechart.send('INCREMENT');
          }

          @action
          minusClicked() {
            this.statechart.send('DECREMENT');
          }
        }

        setComponentTemplate(this.counterTemplate, Counter);

        this.owner.register('component:counter', Counter);

        await render(hbs`
    <Counter />
    `);

        assert.dom('[data-test-count="0"]').exists('count is 0 initially');

        await click('[data-test-plus]');

        assert.dom('[data-test-count="1"]').exists('count was updated - 1');

        await click('[data-test-minus]');

        assert
          .dom('[data-test-count="0"]')
          .exists('count was updated - 0 again');
      });

      test('it is possible to use `assign` with a function that returns the updated state', async function (assert) {
        const { counterMachine } = this;

        class Counter extends Component {
          statechart = useMachine(this, () => {
            return {
              machine: counterMachine
                .withContext({
                  count: 0,
                })
                .withConfig({
                  actions: {
                    increment: actions.assign((context) => {
                      return {
                        count: context.count + 1,
                      };
                    }),
                    decrement: actions.assign((context) => {
                      return {
                        count: context.count - 1,
                      };
                    }),
                  },
                }),
            };
          });

          @action
          plusClicked() {
            this.statechart.send('INCREMENT');
          }

          @action
          minusClicked() {
            this.statechart.send('DECREMENT');
          }
        }

        setComponentTemplate(this.counterTemplate, Counter);

        this.owner.register('component:counter', Counter);

        await render(hbs`
      <Counter />
      `);

        assert.dom('[data-test-count="0"]').exists('count is 0 initially');

        await click('[data-test-plus]');

        assert.dom('[data-test-count="1"]').exists('count was updated - 1');

        await click('[data-test-minus]');

        assert
          .dom('[data-test-count="0"]')
          .exists('count was updated - 0 again');
      });

      test('reactive getters are possible based on `assign`ed context changes', async function (assert) {
        const { counterMachine } = this;

        class Counter extends Component {
          statechart = useMachine(this, () => {
            return {
              machine: counterMachine
                .withContext({
                  count: 0,
                })
                .withConfig({
                  actions: {
                    increment: actions.assign({
                      count: (context) => context.count + 1,
                    }),
                    decrement: actions.assign({
                      count: (context) => context.count - 1,
                    }),
                  },
                }),
            };
          });

          get plusIsDisabled() {
            return this.statechart.state.context.count > 0;
          }

          @action
          plusClicked() {
            this.statechart.send('INCREMENT');
          }

          @action
          minusClicked() {
            this.statechart.send('DECREMENT');
          }
        }

        setComponentTemplate(
          hbs`
            <div>
              {{this.statechart.state.context.count}}
            </div>
            <button
              type="button"
              disabled={{this.plusIsDisabled}}
              data-test-plus
              {{on "click" this.plusClicked}}
            >
              +
            </button>
            <button
                type="button"
                data-test-minus
                {{on "click" this.minusClicked}}
            >
              -
            </button>
          `,
          Counter
        );

        this.owner.register('component:counter', Counter);

        await render(hbs`
          <Counter />
        `);

        assert
          .dom('[data-test-plus]')
          .isNotDisabled('plus button is not disabled - count is 0');

        await click('[data-test-plus]');

        assert
          .dom('[data-test-plus]')
          .isDisabled('plus button disabled updated - count is above 0');
      });

      module(
        'changes to arguments passed to `useMachine` et al. can be handled',
        function () {
          test('`update` callback is called', async function (assert) {
            const testContext = this;

            const counterMachine = Machine(
              {
                initial: 'active',
                context: {
                  count: 0,
                },
                states: {
                  active: {
                    on: {
                      INCREMENT: {
                        target: 'active',
                        actions: ['incrementCounter'],
                      },
                    },
                  },
                },
              },
              {
                actions: {
                  incrementCounter: actions.assign({
                    count: (context) => context.count + 1,
                  }),
                },
              }
            );

            class Test extends Component {
              statechart = useMachine(this, () => {
                return {
                  machine: counterMachine.withContext({
                    count: this.args.initialCount,
                  }),
                  update: () => {
                    assert.step('update called');
                  },
                };
              });

              constructor(owner, args) {
                super(owner, args);

                testContext.test = this;
              }
            }

            const testTemplate = hbs`
              <div>{{this.statechart.state.value}}</div>
            `;

            setComponentTemplate(testTemplate, Test);

            this.owner.register('component:test', Test);

            this.set('initialCount', 0);

            await render(hbs`
      <Test @initialCount={{this.initialCount}}/>
      `);

            this.set('initialCount', 9000);

            assert.verifySteps(['update called']);
          });

          test('events can be send to the interpreter', async function (assert) {
            const testContext = this;

            const counterMachine = Machine(
              {
                initial: 'active',
                context: {
                  count: 0,
                },
                states: {
                  active: {
                    on: {
                      INCREMENT: {
                        target: 'active',
                        actions: ['incrementCounter'],
                      },
                      RESET_COUNT: {
                        target: 'active',
                        actions: ['resetCounter'],
                      },
                    },
                  },
                },
              },
              {
                actions: {
                  incrementCounter: actions.assign({
                    count: (context) => context.count + 1,
                  }),
                },
              }
            );

            class Test extends Component {
              statechart = useMachine(this, () => {
                return {
                  machine: counterMachine
                    .withContext({
                      count: this.args.initialCount,
                    })
                    .withConfig({
                      actions: {
                        resetCounter() {
                          assert.step('resetCounter action called');
                        },
                      },
                    }),
                  update({ send }) {
                    send('RESET_COUNT');
                  },
                };
              });

              constructor(owner, args) {
                super(owner, args);

                testContext.test = this;
              }
            }

            const testTemplate = hbs`
              <div>{{this.statechart.state.context.count}}</div>
            `;

            setComponentTemplate(testTemplate, Test);

            this.owner.register('component:test', Test);

            this.set('initialCount', 0);

            await render(hbs`
          <Test @initialCount={{this.initialCount}}/>
          `);

            this.set('initialCount', 9000);

            assert.verifySteps(['resetCounter action called']);
          });

          test('the interpreter can be resetup with updated values', async function (assert) {
            const testContext = this;

            const counterMachine = Machine(
              {
                initial: 'inactive',
                context: {
                  count: 0,
                },
                states: {
                  inactive: {
                    on: {
                      ACTIVATE: 'active',
                    },
                  },
                  active: {
                    on: {
                      INCREMENT: {
                        target: 'active',
                        actions: ['incrementCounter'],
                      },
                    },
                  },
                },
              },
              {
                actions: {
                  incrementCounter: actions.assign({
                    count: (context) => context.count + 1,
                  }),
                },
              }
            );

            class Test extends Component {
              statechart = useMachine(this, () => {
                return {
                  machine: counterMachine.withContext({
                    count: this.args.initialCount,
                  }),
                  update({ restart }) {
                    restart();
                  },
                };
              });

              constructor(owner, args) {
                super(owner, args);

                testContext.test = this;
              }
            }

            const testTemplate = hbs`
              <div>{{this.statechart.state.context.count}}</div>
              <div>{{this.statechart.state.value}}</div>
            `;

            setComponentTemplate(testTemplate, Test);

            this.owner.register('component:test', Test);

            this.set('initialCount', 0);

            await render(hbs`
      <Test @initialCount={{this.initialCount}}/>
      `);

            this.test.statechart.send('ACTIVATE');

            assert.equal(
              this.test.statechart.state.value,
              'active',
              'statechart transitioned into `active`'
            );

            this.set('initialCount', 9000);

            await waitUntil(() => {
              return this.test.statechart.state.value === 'inactive';
            });

            assert.equal(
              this.test.statechart.state.value,
              'inactive',
              'statechart was restarted and is in initial state `inactive`'
            );

            assert.equal(
              this.test.statechart.state.context.count,
              9000,
              'statechart was restarted with updated count'
            );

            this.test.statechart.send('ACTIVATE');

            assert.equal(
              this.test.statechart.state.value,
              'active',
              'after restarting statechart can be interacted with again'
            );
          });
        }
      );

      test('`useMachine` works with `matchesState`', async function (assert) {
        const testContext = this;
        const { TestMachine } = this;

        class Test extends Component {
          statechart = useMachine(this, () => {
            return {
              machine: TestMachine,
            };
          });

          @matchesState('stopped')
          isStopped;

          constructor(owner, args) {
            super(owner, args);

            testContext.test = this;

            this.name = 'Tomster';
          }
        }

        this.owner.register('component:test', Test);

        await render(hbs`
      <Test />
      `);

        assert.true(
          testContext.test.isStopped,
          'matchesState works against initial state'
        );

        testContext.test.statechart.send('START');

        assert.false(
          testContext.test.isStopped,
          'matchesState updates correctly when state updates'
        );
      });

      module('starting/restarting machine in specific state', function () {
        test('start - it is possible to start a machine at a specific state', async function (assert) {
          const testContext = this;

          const machine = Machine({
            initial: 'inactive',
            states: {
              inactive: {
                on: {
                  START: 'active',
                },
              },
              active: {
                on: {
                  STOP: 'inactive',
                },
              },
            },
          });

          class Test extends Component {
            statechart = useMachine(this, () => {
              return {
                machine,
                initialState: this.args.state,
              };
            });

            constructor(owner, args) {
              super(owner, args);

              testContext.test = this;
            }
          }

          this.owner.register('component:test', Test);

          this.state = 'active';

          await render(hbs`
            <Test @state={{this.state}}/>
          `);

          assert.equal(
            this.test.statechart.state.value,
            'active',
            'statechart started in correct state'
          );
        });

        module('restart - ', function () {
          test('calling `restart` will restart interpreter in passed `initialState`', async function (assert) {
            const testContext = this;

            const machine = Machine({
              initial: 'inactive',
              states: {
                inactive: {
                  on: {
                    START: 'active',
                  },
                },
                active: {
                  on: {
                    STOP: 'inactive',
                  },
                },
              },
            });

            class Test extends Component {
              statechart = useMachine(this, () => {
                return {
                  machine,
                  initialState: this.args.state,
                  update: ({ restart }) => {
                    restart();
                  },
                };
              });

              constructor(owner, args) {
                super(owner, args);

                testContext.test = this;
              }
            }

            this.owner.register('component:test', Test);

            await render(hbs`
      <Test @state={{this.state}}/>
      `);

            assert.equal(
              this.test.statechart.state.value,
              'inactive',
              'no state passed initially - current state is the correct initial state'
            );

            this.set('state', 'active');

            assert.equal(
              this.test.statechart.state.value,
              'active',
              'state was changed from the outside interpreter was restarted with new state'
            );
          });

          test('it is possible to restart the interpreter in a specific state within `update`', async function (assert) {
            const testContext = this;

            const machine = Machine({
              id: 'wizard',
              initial: 'step-a',
              states: {
                'step-a': {
                  on: {
                    NEXT: 'step-b',
                  },
                },
                'step-b': {
                  on: {
                    NEXT: 'step-c',
                    PREV: 'step-b',
                  },
                },
                'step-c': {
                  on: {
                    PREV: 'step-b',
                  },
                },
              },
            });

            class Test extends Component {
              statechart = useMachine(this, () => {
                return {
                  machine: machine.withContext({
                    currentWizardStep: this.args.step,
                  }),
                  update({ restart, machine }) {
                    const {
                      context: { currentWizardStep },
                    } = machine;

                    restart(currentWizardStep);
                  },
                };
              });

              constructor(owner, args) {
                super(owner, args);

                testContext.test = this;
              }
            }

            this.owner.register('component:test', Test);

            await render(hbs`
      <Test @step={{this.step}}/>
      `);

            assert.equal(
              this.test.statechart.state.value,
              'step-a',
              'no state passed initially - current state is the correct initial state'
            );

            this.set('step', 'step-c');

            assert.equal(
              this.test.statechart.state.value,
              'step-c',
              'state was changed from the outside interpreter was restarted with new state'
            );
          });
        });
      });
      module('#onTransition', function () {
        test('it is possible to react to state changes', async function (assert) {
          const testContext = this;

          const machine = Machine({
            initial: 'inactive',
            states: {
              inactive: {
                on: {
                  START: 'active',
                },
              },
              active: {
                on: {
                  STOP: 'inactive',
                },
              },
            },
          });

          class Test extends Component {
            statechart = useMachine(this, () => {
              return {
                machine,
                onTransition(state) {
                  assert.step(state.value);
                },
              };
            });

            constructor(owner, args) {
              super(owner, args);

              testContext.test = this;
            }
          }

          this.owner.register('component:test', Test);

          await render(hbs`
            <Test @state={{this.state}}/>
          `);

          this.test.statechart.state;

          assert.verifySteps(
            ['inactive'],
            '`onTransition` fired on initial transition'
          );

          this.test.statechart.send('START');

          assert.verifySteps(
            ['active'],
            '`onTransition` fired on regular state transition'
          );
        });
      });
    });
  });
});
