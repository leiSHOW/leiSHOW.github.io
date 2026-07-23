(function () {
  const CONTAINER_ID = "jsi-flying-fish-container";
  const FOOTER_READY_CLASS = "footer-fish-ready";

  class SurfacePoint {
    constructor(renderer, x) {
      this.renderer = renderer;
      this.x = x;
      this.init();
    }

    init() {
      this.initHeight = this.renderer.height * this.renderer.INIT_HEIGHT_RATE;
      this.height = this.initHeight;
      this.fy = 0;
      this.force = { previous: 0, next: 0 };
    }

    setPreviousPoint(previous) {
      this.previous = previous;
    }

    setNextPoint(next) {
      this.next = next;
    }

    interfere(y, velocity) {
      const direction = this.renderer.height - this.height - y >= 0 ? -1 : 1;
      this.fy = this.renderer.height * this.ACCELERATION_RATE * direction * Math.abs(velocity);
    }

    updateSelf() {
      this.fy += this.SPRING_CONSTANT * (this.initHeight - this.height);
      this.fy *= this.SPRING_FRICTION;
      this.height += this.fy;
    }

    updateNeighbors() {
      if (this.previous) {
        this.force.previous = this.WAVE_SPREAD * (this.height - this.previous.height);
      }
      if (this.next) {
        this.force.next = this.WAVE_SPREAD * (this.height - this.next.height);
      }
    }

    render(context) {
      if (this.previous) {
        this.previous.height += this.force.previous;
        this.previous.fy += this.force.previous;
      }
      if (this.next) {
        this.next.height += this.force.next;
        this.next.fy += this.force.next;
      }
      context.lineTo(this.x, this.renderer.height - this.height);
    }
  }

  SurfacePoint.prototype.SPRING_CONSTANT = 0.03;
  SurfacePoint.prototype.SPRING_FRICTION = 0.9;
  SurfacePoint.prototype.WAVE_SPREAD = 0.3;
  SurfacePoint.prototype.ACCELERATION_RATE = 0.01;

  class Fish {
    constructor(renderer) {
      this.renderer = renderer;
      this.init();
    }

    init() {
      this.direction = Math.random() < 0.5;
      this.x = this.direction ? this.renderer.width + this.renderer.THRESHOLD : -this.renderer.THRESHOLD;
      this.previousY = this.y;
      this.vx = this.getRandomValue(4, 10) * (this.direction ? -1 : 1);

      if (this.renderer.reverse) {
        this.y = this.getRandomValue(this.renderer.height * 0.1, this.renderer.height * 0.4);
        this.vy = this.getRandomValue(2, 5);
        this.ay = this.getRandomValue(0.05, 0.2);
      } else {
        this.y = this.getRandomValue(this.renderer.height * 0.6, this.renderer.height * 0.9);
        this.vy = this.getRandomValue(-5, -2);
        this.ay = this.getRandomValue(-0.2, -0.05);
      }

      this.isOut = false;
      this.theta = 0;
      this.phi = 0;
    }

    getRandomValue(min, max) {
      return min + (max - min) * Math.random();
    }

    reverseVertical() {
      this.isOut = !this.isOut;
      this.ay *= -1;
    }

    controlStatus() {
      this.previousY = this.y;
      this.x += this.vx;
      this.y += this.vy;
      this.vy += this.ay;

      if (this.renderer.reverse) {
        if (this.y > this.renderer.height * this.renderer.INIT_HEIGHT_RATE) {
          this.vy -= this.GRAVITY;
          this.isOut = true;
        } else {
          if (this.isOut) this.ay = this.getRandomValue(0.05, 0.2);
          this.isOut = false;
        }
      } else if (this.y < this.renderer.height * this.renderer.INIT_HEIGHT_RATE) {
        this.vy += this.GRAVITY;
        this.isOut = true;
      } else {
        if (this.isOut) this.ay = this.getRandomValue(-0.2, -0.05);
        this.isOut = false;
      }

      if (!this.isOut) {
        this.theta = (this.theta + Math.PI / 20) % (Math.PI * 2);
        this.phi = (this.phi + Math.PI / 30) % (Math.PI * 2);
      }

      this.renderer.generateEpicenter(
        this.x + (this.direction ? -1 : 1) * this.renderer.THRESHOLD,
        this.y,
        this.y - this.previousY
      );

      if (
        (this.vx > 0 && this.x > this.renderer.width + this.renderer.THRESHOLD) ||
        (this.vx < 0 && this.x < -this.renderer.THRESHOLD)
      ) {
        this.init();
      }
    }

    render(context) {
      context.save();
      context.translate(this.x, this.y);
      context.rotate(Math.PI + Math.atan2(this.vy, this.vx));
      context.scale(1, this.direction ? 1 : -1);
      context.beginPath();
      context.moveTo(-30, 0);
      context.bezierCurveTo(-20, 15, 15, 10, 40, 0);
      context.bezierCurveTo(15, -10, -20, -15, -30, 0);
      context.fill();

      context.save();
      context.translate(40, 0);
      context.scale(0.9 + 0.2 * Math.sin(this.theta), 1);
      context.beginPath();
      context.moveTo(0, 0);
      context.quadraticCurveTo(5, 10, 20, 8);
      context.quadraticCurveTo(12, 5, 10, 0);
      context.quadraticCurveTo(12, -5, 20, -8);
      context.quadraticCurveTo(5, -10, 0, 0);
      context.fill();
      context.restore();

      context.save();
      context.translate(-3, 0);
      context.rotate((Math.PI / 3 + (Math.PI / 10) * Math.sin(this.phi)) * (this.renderer.reverse ? -1 : 1));
      context.beginPath();
      if (this.renderer.reverse) {
        context.moveTo(5, 0);
        context.bezierCurveTo(10, 10, 10, 30, 0, 40);
        context.bezierCurveTo(-12, 25, -8, 10, 0, 0);
      } else {
        context.moveTo(-5, 0);
        context.bezierCurveTo(-10, -10, -10, -30, 0, -40);
        context.bezierCurveTo(12, -25, 8, -10, 0, 0);
      }
      context.closePath();
      context.fill();
      context.restore();
      context.restore();

      this.controlStatus();
    }
  }

  Fish.prototype.GRAVITY = 0.4;

  class FishRenderer {
    constructor(container) {
      this.container = container;
      this.canvas = document.createElement("canvas");
      this.context = this.canvas.getContext("2d");
      this.points = [];
      this.fishes = [];
      this.reverse = false;
      this.axis = null;
      this.animationFrame = null;
      this.resizeTimer = null;
      this.handleResize = this.watchWindowSize.bind(this);
      this.handleMouseEnter = this.startEpicenter.bind(this);
      this.handleMouseMove = this.moveEpicenter.bind(this);
      this.handleClick = this.reverseVertical.bind(this);
    }

    init() {
      this.destroy();
      this.container.innerHTML = "";
      this.container.appendChild(this.canvas);
      this.setup();
      this.bindEvents();
      this.render();
    }

    destroy() {
      if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
      window.removeEventListener("resize", this.handleResize);
      this.container.removeEventListener("mouseenter", this.handleMouseEnter);
      this.container.removeEventListener("mousemove", this.handleMouseMove);
      this.container.removeEventListener("click", this.handleClick);
    }

    setup() {
      this.points = [];
      this.fishes = [];
      this.intervalCount = this.MAX_INTERVAL_COUNT;
      this.width = this.container.clientWidth;
      this.height = this.container.clientHeight;
      this.fishCount = Math.max(2, Math.round((this.FISH_COUNT * this.width * this.height) / 250000));
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.createSurfacePoints();
      this.fishes.push(new Fish(this));
    }

    createSurfacePoints() {
      const count = Math.max(2, Math.round(this.width / this.POINT_INTERVAL));
      this.pointInterval = this.width / (count - 1);
      this.points.push(new SurfacePoint(this, 0));
      for (let i = 1; i < count; i += 1) {
        const point = new SurfacePoint(this, i * this.pointInterval);
        const previous = this.points[i - 1];
        point.setPreviousPoint(previous);
        previous.setNextPoint(point);
        this.points.push(point);
      }
    }

    bindEvents() {
      window.addEventListener("resize", this.handleResize);
      this.container.addEventListener("mouseenter", this.handleMouseEnter);
      this.container.addEventListener("mousemove", this.handleMouseMove);
      this.container.addEventListener("click", this.handleClick);
    }

    watchWindowSize() {
      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => this.setup(), 150);
    }

    getAxis(event) {
      const rect = this.container.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    }

    startEpicenter(event) {
      this.axis = this.getAxis(event);
    }

    moveEpicenter(event) {
      const axis = this.getAxis(event);
      if (!this.axis) this.axis = axis;
      this.generateEpicenter(axis.x, axis.y, axis.y - this.axis.y);
      this.axis = axis;
    }

    generateEpicenter(x, y, velocity) {
      if (y < this.height / 2 - this.THRESHOLD || y > this.height / 2 + this.THRESHOLD) return;
      const index = Math.round(x / this.pointInterval);
      if (index < 0 || index >= this.points.length) return;
      this.points[index].interfere(y, velocity);
    }

    reverseVertical() {
      this.reverse = !this.reverse;
      this.fishes.forEach((fish) => fish.reverseVertical());
    }

    controlStatus() {
      this.points.forEach((point) => point.updateSelf());
      this.points.forEach((point) => point.updateNeighbors());
      if (this.fishes.length < this.fishCount && --this.intervalCount <= 0) {
        this.intervalCount = this.MAX_INTERVAL_COUNT;
        this.fishes.push(new Fish(this));
      }
    }

    render() {
      this.animationFrame = requestAnimationFrame(() => this.render());
      this.controlStatus();
      this.context.clearRect(0, 0, this.width, this.height);
      this.context.fillStyle = "rgba(255, 255, 255, 0.88)";
      this.fishes.forEach((fish) => fish.render(this.context));

      this.context.save();
      this.context.globalCompositeOperation = "xor";
      this.context.beginPath();
      this.context.moveTo(0, this.reverse ? 0 : this.height);
      this.points.forEach((point) => point.render(this.context));
      this.context.lineTo(this.width, this.reverse ? 0 : this.height);
      this.context.closePath();
      this.context.fill();
      this.context.restore();
    }
  }

  FishRenderer.prototype.POINT_INTERVAL = 5;
  FishRenderer.prototype.FISH_COUNT = 3;
  FishRenderer.prototype.MAX_INTERVAL_COUNT = 50;
  FishRenderer.prototype.INIT_HEIGHT_RATE = 0.5;
  FishRenderer.prototype.THRESHOLD = 50;

  let renderer;

  function ensureContainer() {
    const footer = document.getElementById("footer");
    const footerWrap = document.getElementById("footer-wrap");
    if (!footer || !footerWrap) return null;

    let container = document.getElementById(CONTAINER_ID);
    if (!container) {
      container = document.createElement("div");
      container.id = CONTAINER_ID;
      footer.insertBefore(container, footerWrap);
    }

    footer.classList.add(FOOTER_READY_CLASS);
    return container;
  }

  function initFooterFish() {
    const container = ensureContainer();
    if (!container) return;
    renderer = new FishRenderer(container);
    renderer.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFooterFish, { once: true });
  } else {
    initFooterFish();
  }

  document.addEventListener("pjax:complete", initFooterFish);
})();
