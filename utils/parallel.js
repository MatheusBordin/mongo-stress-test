const chalk = require('chalk');

/**
 * Parallel implementation.
 *
 * @class Parallel
 */
class Parallel {

  /**
   * Create parallel instance.
   *
   * @static
   * @param {Function} handler Consumer handler
   * @param {Number} count Count of executions
   * @param {Number} concurrency Max concurrency size
   * @returns
   * @memberof Parallel
   */
  static create(handler, count, concurrency) {
    const process = new Parallel({
      count,
      concurrency,
      consumerHandler: handler
    });

    process.start();

    return process;
  }

	constructor(options) {
		this._count = options.count;
		this._concurrency = options.concurrency || options.count;
    this._handler = options.consumerHandler;
		this._stack = [];
    this._offset = 0;
    this._paused = false;
    this._processing = 0;

    if (this._count < this._concurrency) {
      this._concurrency = this._count;
    }
  }
  
  /**
   * Return current offset.
   *
   * @readonly
   * @memberof Parallel
   */
  get offset() {
    return this._offset;
  }

	/**
   * Start process.
   * Cannot use that, use static generator intead.
   *
   * @memberof Parallel
   */
  start() {
		for (let i = 0; i < this._concurrency; i++) {
			this._consume();
		}
  }
  
  /**
   * Pause parallel running process.
   *
   * @returns
   * @memberof Parallel
   */
  pause() {
    if (this._processing === 0 || this.pause) {
      console.warn('Pause method called on stoped parallel instance');
      return Promise.resolve();
    }

    this._paused = true;

    return new Promise(async (res) => {
      while (this._processing > 0) {
        await this._sleep(500);
      }

      res();
    });
  }

  /**
   * Resume paused process.
   *
   * @returns
   * @memberof Parallel
   */
  resume() {
    if (this._processing > 0) {
      console.warn('Resume method cannot be called at running parallel instance');
      return false;
    }

    this._paused = false;
    this._concurrency = Math.min(this._concurrency, this._count - this._concurrency);

    for (let i = 0; i < this._concurrency; i++) {
			this._consume(false);
		}
  }

  /**
   * Wait for all work be done.
   *
   * @returns
   * @memberof Parallel
   */
  waitFinish() {
    if (this._offset === this._count) {
      return Promise.resolve();
    }

    return new Promise((res) => {
      this._finishHandler = res;
    });
  }

	/**
   * Consume message.
   *
   * @memberof Parallel
   */
  async _consume() {
    this._processing++;
    this._offset++;
    
    try {
      await this._handler(this._offset);
    } catch (e) {
      console.log(chalk`{red Error} processing message with offset: ${this._offset}`);
    }

    this._processing--;

    if (this._offset === this._count) {
      // Finish
      if (this._finishHandler != null) {
        this._finishHandler();
      }
    } else if (!this._paused && this._offset + this._processing < this._count) {
      // Is not finish and not paused
      this._consume();
    }
  }
  
  /**
   * Sleep time.
   *
   * @param {Number} time Time to sleep
   * @returns
   * @memberof Parallel
   */
  _sleep(time) {
    return new Promise((res) => {
      setTimeout(res, time);
    });
  }
}

module.exports = Parallel;