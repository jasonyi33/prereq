// Demo auto-responder: simulates 3 students answering polls
// Alex (correct), Jordan (partial), Taylor (wrong)
// Called by the poll activate route when DEMO_MODE=true

const FLASK_API_URL = process.env.FLASK_API_URL || "http://localhost:5000";
const NEXT_API_BASE = `http://localhost:${process.env.PORT || 3000}`;

// Student IDs are fetched once from Flask on first use
let cachedStudents: { alex?: string; jordan?: string; taylor?: string } | null = null;

async function getAutoResponderStudents(courseId?: string): Promise<typeof cachedStudents> {
  if (cachedStudents) return cachedStudents;

  try {
    // Fetch all courses, find the first one (demo has one course)
    const coursesRes = await fetch(`${FLASK_API_URL}/api/courses`, {
      headers: { "ngrok-skip-browser-warning": "1" },
    });
    const courses = await coursesRes.json();
    const cId = courseId || courses[0]?.id;
    if (!cId) return null;

    const studentsRes = await fetch(`${FLASK_API_URL}/api/courses/${cId}/students`, {
      headers: { "ngrok-skip-browser-warning": "1" },
    });
    const students = await studentsRes.json();

    // Match by name (seed data uses Alex, Jordan, Taylor, Sam)
    const result: { alex?: string; jordan?: string; taylor?: string } = {};
    for (const s of students) {
      const name = s.name?.toLowerCase();
      if (name?.includes("alex")) result.alex = s.id;
      else if (name?.includes("jordan")) result.jordan = s.id;
      else if (name?.includes("taylor")) result.taylor = s.id;
    }

    if (result.alex || result.jordan || result.taylor) {
      cachedStudents = result;
    }
    return result;
  } catch (err) {
    console.warn("[AutoResponder] Failed to fetch students:", err);
    return null;
  }
}

// Scripted answer templates per concept — keyed by lowercase concept label substrings
const ANSWER_TEMPLATES: Record<string, { correct: string; partial: string; wrong: string }> = {
  "chain rule": {
    correct: "The chain rule states that the derivative of a composite function is the product of the derivatives of each function in the composition. For f(g(x)), it's f'(g(x)) * g'(x). In neural networks, this lets us compute gradients layer by layer by multiplying local derivatives as we propagate backwards.",
    partial: "The chain rule is about multiplying derivatives together when functions are nested. You use it to go backwards through the network layers.",
    wrong: "The chain rule is when you add up all the derivatives in each layer to get the total gradient.",
  },
  "backpropagation": {
    correct: "Backpropagation applies the chain rule systematically through a computational graph. Starting from the loss, we compute the gradient at each node by multiplying the upstream gradient with the local derivative, propagating backwards through every layer to obtain gradients for all weights.",
    partial: "Backpropagation goes backwards through the network to figure out how to adjust the weights. It uses derivatives somehow to send error signals back.",
    wrong: "Backpropagation sends the input data backwards through the network to see which neurons fired incorrectly, then flips their activation.",
  },
  "gradient descent": {
    correct: "Gradient descent is an iterative optimization algorithm that updates parameters by subtracting the gradient of the loss function scaled by the learning rate: w_new = w_old - lr * dL/dw. This moves parameters in the direction that decreases the loss most steeply.",
    partial: "Gradient descent updates the weights to make the loss smaller. You take steps proportional to the gradient but in the opposite direction.",
    wrong: "Gradient descent randomly tries different weight values and keeps the ones that give a lower loss.",
  },
  "gradient": {
    correct: "A gradient is a vector of partial derivatives that points in the direction of steepest increase of a function. For a loss function with respect to model weights, each component tells us how much the loss changes when we adjust that particular weight. We follow the negative gradient to minimize loss.",
    partial: "The gradient tells you which direction to go to increase or decrease the function. It's like the slope but for multiple dimensions.",
    wrong: "The gradient is the average of all the weights in the network, showing the overall direction of learning.",
  },
  "computational graph": {
    correct: "A computational graph represents the sequence of operations in a neural network as a directed acyclic graph. Each node is an operation (matrix multiply, activation, etc.), and edges represent data flow. This structure lets us apply the chain rule efficiently during backpropagation by computing local derivatives at each node.",
    partial: "It's a graph showing how computations flow through the network. Each operation is a node and you can trace how data moves from input to output.",
    wrong: "A computational graph is a visualization of the network architecture showing how many neurons are in each layer.",
  },
  "loss function": {
    correct: "A loss function quantifies the difference between the model's predictions and the true labels, providing a scalar objective to minimize. Common examples include MSE for regression (average of squared differences) and cross-entropy for classification. The choice of loss function affects the gradient landscape and training dynamics.",
    partial: "A loss function tells you how wrong the model is. Lower loss means better predictions. You try to minimize it during training.",
    wrong: "The loss function counts how many predictions the model got wrong and divides by the total number of samples.",
  },
  "learning rate": {
    correct: "The learning rate is a hyperparameter that controls the step size during gradient descent. It scales the gradient before subtracting from the weights: w = w - lr * gradient. Too large causes overshooting and divergence, too small causes slow convergence. It's typically set between 0.001 and 0.01.",
    partial: "The learning rate controls how big the steps are when updating weights. If it's too big you overshoot, too small and it's slow.",
    wrong: "The learning rate is how fast the model memorizes the training data. Higher means it learns the data faster.",
  },
};

// Fallback templates when concept doesn't match any specific template
const FALLBACK_TEMPLATES = {
  correct: "Based on the lecture material, this concept works by establishing a mathematical foundation where the key relationships between variables are preserved through the transformation. The derivation follows from the fundamental definitions and can be verified through direct computation.",
  partial: "I think this has to do with how the model processes the data through different stages. The math behind it involves some kind of transformation or calculation at each step.",
  wrong: "I'm not sure but I think this is when the model adjusts its internal structure by randomly sampling from the input distribution.",
};

function getAnswers(conceptLabel: string): { correct: string; partial: string; wrong: string } {
  const lower = conceptLabel.toLowerCase();
  for (const [key, templates] of Object.entries(ANSWER_TEMPLATES)) {
    if (lower.includes(key)) return templates;
  }
  return FALLBACK_TEMPLATES;
}

export function onPollActivated(pollId: string, question: string, conceptLabel: string): void {
  console.log(`[AutoResponder] Poll activated: ${pollId} (concept: ${conceptLabel})`);

  const answers = getAnswers(conceptLabel);

  // Schedule responses for each auto-responding student
  const respondents: Array<{ role: keyof typeof answers; studentKey: "alex" | "jordan" | "taylor" }> = [
    { role: "correct", studentKey: "alex" },
    { role: "partial", studentKey: "jordan" },
    { role: "wrong", studentKey: "taylor" },
  ];

  for (const { role, studentKey } of respondents) {
    // Random 5-15 second delay per student
    const delay = 5000 + Math.random() * 10000;

    setTimeout(async () => {
      const students = await getAutoResponderStudents();
      const studentId = students?.[studentKey];
      if (!studentId) {
        console.warn(`[AutoResponder] Student ${studentKey} not found, skipping`);
        return;
      }

      try {
        const res = await fetch(`${NEXT_API_BASE}/api/polls/${pollId}/respond`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId,
            answer: answers[role],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          console.log(`[AutoResponder] ${studentKey} (${role}) responded → eval: ${data.evaluation?.eval_result}`);
        } else {
          console.warn(`[AutoResponder] ${studentKey} response failed: ${res.status}`);
        }
      } catch (err) {
        console.warn(`[AutoResponder] ${studentKey} error:`, err);
      }
    }, delay);
  }
}
