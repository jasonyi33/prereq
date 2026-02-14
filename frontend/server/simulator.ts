// Transcript simulator for demo mode
// Sends hardcoded lecture chunks to the transcript endpoint every 3-5 seconds

const TRANSCRIPT_CHUNKS = [
  "Welcome everyone to today's lecture. We're going to dive deep into how neural networks actually learn from data, starting with the math that makes it all possible.",
  "Let's begin with a quick refresher on loss functions. A loss function measures how far off our model's predictions are from the actual values. Think of it as a score — the lower the loss, the better our model is doing.",
  "The most common loss function you'll see is mean squared error, or MSE. For each prediction, we take the difference from the true value, square it, and average across all samples. Simple but effective for regression tasks.",
  "Now here's the key question: once we have a loss value, how do we improve? That's where gradients come in. The gradient tells us the direction and rate of steepest increase of our loss function.",
  "Remember from calculus, a gradient is just a vector of partial derivatives. Each component tells us how much the loss changes when we nudge one particular weight. If the partial derivative is positive, increasing that weight increases the loss.",
  "So to minimize the loss, we move in the opposite direction of the gradient. This is the core idea behind gradient descent — we iteratively take steps downhill on the loss surface.",
  "The size of each step is controlled by the learning rate. Too large and we overshoot the minimum, too small and training takes forever. Finding the right learning rate is one of the most important hyperparameter choices.",
  "Let me draw this on the board. Imagine a bowl-shaped surface — that's our loss landscape in two dimensions. Gradient descent is like placing a ball at a random point and letting it roll downhill.",
  "But neural networks have millions of parameters, so the loss landscape is incredibly high-dimensional. There are saddle points, local minima, and flat plateaus. That's why vanilla gradient descent often isn't enough.",
  "Now let's talk about how we actually compute these gradients efficiently. This is where backpropagation comes in — arguably the most important algorithm in deep learning.",
  "Backpropagation is just the chain rule applied systematically through the network. We compute the gradient of the loss with respect to each weight by working backwards from the output layer to the input.",
  "Think of a neural network as a computational graph. Each node represents an operation — a matrix multiply, an addition, an activation function. Data flows forward through the graph during the forward pass.",
  "During the forward pass, each layer takes its input, multiplies by weights, adds a bias, and applies an activation function. The output of one layer becomes the input to the next.",
  "The chain rule from calculus is what makes backpropagation work. If y depends on u, and u depends on x, then dy/dx equals dy/du times du/dx. We just chain together local derivatives.",
  "So during backpropagation, we start at the loss and work backwards. At each node in the computational graph, we multiply the incoming gradient by the local derivative. This gives us the gradient flowing to the previous layer.",
  "Let's trace through a concrete example. Say we have a two-layer network. The loss gradient flows back through the output activation, then through the second weight matrix, then through the hidden activation, then through the first weight matrix.",
  "At each weight matrix, we now have the gradient of the loss with respect to those weights. These are exactly the values we need for gradient descent — they tell us how to update each weight to reduce the loss.",
  "Once we have all the gradients, the weight update rule is straightforward. New weight equals old weight minus learning rate times gradient. We do this for every weight in the network simultaneously.",
  "In practice, we don't compute gradients over the entire dataset at once. Stochastic gradient descent, or SGD, uses random mini-batches of data. This is faster and actually helps escape local minima due to the noise it introduces.",
  "Let me emphasize something important about computational graphs. Modern frameworks like PyTorch build these graphs dynamically as you run your forward pass. They track every operation so they can automatically differentiate.",
  "This automatic differentiation means you never have to derive gradients by hand. You define the forward computation, and the framework handles backpropagation for you. But understanding what's happening under the hood is crucial.",
  "Let's connect this back to loss functions for a moment. Different loss functions produce different gradient landscapes. Cross-entropy loss, for instance, produces stronger gradients when the model is very wrong, which speeds up early training.",
  "One thing students often get confused about is the difference between the gradient of the loss and the gradient of the activation. The chain rule connects them, but they're distinct quantities flowing through different parts of the graph.",
  "For the activation functions — sigmoid, ReLU, tanh — each has a different local derivative. ReLU's derivative is just zero or one, which is part of why it's so popular: the gradients flow through unchanged when the neuron is active.",
  "The vanishing gradient problem happens when local derivatives are consistently small, so the chain rule products shrink exponentially as we go deeper. This was a major bottleneck before ReLU and residual connections solved it.",
  "To summarize today's key ideas: loss functions measure model error, gradients point toward steeper loss, gradient descent follows the negative gradient to improve, and backpropagation efficiently computes gradients using the chain rule over computational graphs.",
];

let currentTimeout: ReturnType<typeof setTimeout> | null = null;
let running = false;

export function startSimulator(lectureId: string, courseId: string): void {
  // Stop any existing simulator before starting a new one
  if (running) {
    stopSimulator();
  }
  running = true;
  console.log(`[Simulator] Starting demo transcript for lecture ${lectureId}`);

  const baseUrl = `http://localhost:${process.env.PORT || 3000}`;
  let chunkIndex = 0;
  let timestampSec = 0;

  function sendNextChunk() {
    if (!running || chunkIndex >= TRANSCRIPT_CHUNKS.length) {
      running = false;
      console.log("[Simulator] Finished sending all transcript chunks");
      return;
    }

    const currentChunk = chunkIndex;
    const text = TRANSCRIPT_CHUNKS[currentChunk];
    const timestamp = timestampSec;

    fetch(`${baseUrl}/api/lectures/${lectureId}/transcript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        timestamp,
        speakerName: "Professor",
      }),
    })
      .then((res) => {
        if (!res.ok) console.warn(`[Simulator] Chunk ${currentChunk} failed: ${res.status}`);
      })
      .catch((err) => {
        console.warn(`[Simulator] Chunk ${currentChunk} error:`, err.message);
      });

    chunkIndex++;
    // Increment timestamp by 5-8 seconds (realistic lecture pacing)
    timestampSec += 5 + Math.random() * 3;

    // Schedule next chunk in 3-5 seconds
    const delay = 3000 + Math.random() * 2000;
    currentTimeout = setTimeout(sendNextChunk, delay);
  }

  // Start after a short initial delay
  currentTimeout = setTimeout(sendNextChunk, 1000);
}

export function stopSimulator(): void {
  running = false;
  if (currentTimeout) {
    clearTimeout(currentTimeout);
    currentTimeout = null;
  }
  console.log("[Simulator] Stopped");
}
