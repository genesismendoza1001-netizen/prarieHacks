// Get the model for predicting manure smell levels
class ManureSmellModel {
  static LEVELS = [
    "No smell",
    "Slight smell",
    "Moderate smell",
    "Strong smell",
    "Very strong smell"
  ];

  static THRESHOLDS = [-1, 0.5, 2, 3.5];
  static SCALE = 0.8;

  static clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  static sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  }

  static validate(input) {
    const numeric = [
      "temperatureF",
      "humidity",
      "windSpeedMph",
      "distanceMiles"
    ];

    for (const key of numeric) {
      if (!Number.isFinite(input[key])) {
        throw new Error(`${key} must be a finite number`);
      }
    }

    if (input.humidity < 0 || input.humidity > 100) {
      throw new Error("Humidity must be between 0 and 100");
    }

    if (input.windSpeedMph < 0 || input.distanceMiles < 0) {
      throw new Error("Wind speed and distance cannot be negative");
    }

    for (const key of [
      "manureSpreading", "windTowardYou", "inversion"
    ]) {
      if (typeof input[key] !== "boolean") {
        throw new Error(`${key} must be a boolean`);
      }
    }
  }

  static calculateScore(input) {
    this.validate(input);

    const {
      manureSpreading,
      windTowardYou,
      inversion,
      temperatureF,
      humidity,
      windSpeedMph,
      distanceMiles
    } = input;

    const M = manureSpreading ? 1 : 0;
    const Wd = windTowardYou ? 1 : 0;
    const Wa = windTowardYou ? 0 : 1;
    const I = inversion ? 1 : 0;

    const Hn = humidity / 100;

    const Tn = this.clamp(
      (temperatureF - 30) / 60, 0, 1
    );

    const score =
      -2.3 +
      1.9 * M +
      2.1 * Wd -
      1.4 * Wa +
      1.1 * I +
      0.35 * Hn +
      0.45 * Tn -
      0.26 * Math.log(1 + distanceMiles) -
      0.065 * Math.abs(windSpeedMph - 5);

    return score;
  }

  static predict(input) {
    const score = this.calculateScore(input);

    // P(Y <= k), for k = 0, 1, 2, 3
    const cumulative = this.THRESHOLDS.map(
      threshold =>
        this.sigmoid((threshold - score) / this.SCALE)
    );

    // Convert cumulative probabilities to
    // individual category probabilities.
    const probabilities = [
      cumulative[0],
      cumulative[1] - cumulative[0],
      cumulative[2] - cumulative[1],
      cumulative[3] - cumulative[2],
      1 - cumulative[3]
    ];

    const predictedLevel = probabilities.indexOf(
      Math.max(...probabilities)
    );

    const expectedLevel = probabilities.reduce(
      (sum, probability, index) =>
        sum + probability * index,
      0
    );

    return {
      score,
      predictedLevel,
      predictedLabel: this.LEVELS[predictedLevel],
      expectedLevel,
      probabilities,
      probabilityModerateOrWorse:
        probabilities[2] +
        probabilities[3] +
        probabilities[4]
    };
  }

  static printPrediction(result) {
    console.log("\nIOWA MANURE SMELL FORECAST");
    console.log("-------------------------------");
    console.log(`Smell score: ${result.score.toFixed(3)}`);
    console.log(`Prediction: ${result.predictedLabel}`);
    console.log(
      `Expected level: ${result.expectedLevel.toFixed(2)} / 4`
    );

    console.log("\nProbability distribution:");

    result.probabilities.forEach((p, i) => {
      const percentage = (p * 100).toFixed(1);
      console.log(`${i} - ${this.LEVELS[i]}: ${percentage}%`);
    });

    console.log(
      "\nProbability of moderate or worse: " +
      (result.probabilityModerateOrWorse * 100).toFixed(1) +
      "%"
    );
  }
}

// Example input
const conditions = {
  manureSpreading: true,
  windTowardYou: true,
  inversion: false,
  temperatureF: 55,
  humidity: 65,
  windSpeedMph: 6,
  distanceMiles: 3
};

const prediction = ManureSmellModel.predict(conditions);
ManureSmellModel.printPrediction(prediction);

// Optional: export for use in another Node.js file.
if (typeof module !== "undefined") {
  module.exports = ManureSmellModel;
}
