const fs = require('fs');
const questions = require('./questions.json');
const traits = Object.keys(require('./traits.json'));

// 1. Mean-center each question per trait
const balancedQuestions = questions.map(question => {
    const newAnswers = question.answers.map(a => ({ ...a, scores: { ...a.scores } }));

    traits.forEach(trait => {
        // Calculate the average for the current trait in this question
        let sum = 0;
        let answerCount = 0;
        newAnswers.forEach(answer => {
            if (answer.scores.hasOwnProperty(trait)) {
                sum += answer.scores[trait];
                answerCount++;
            }
        });

        if (answerCount > 0) {
            const mean = sum / answerCount;

            // Subtract the mean from each answer's score for that trait
            newAnswers.forEach(answer => {
                if (answer.scores.hasOwnProperty(trait)) {
                    const originalScore = answer.scores[trait];
                    const centeredScore = originalScore - mean;
                    // Round to 2 decimal places to avoid floating point issues
                    const roundedScore = Math.round(centeredScore * 100) / 100;
                    answer.scores[trait] = roundedScore;
                }
            });
        }
    });

    return { ...question, answers: newAnswers };
});


// Optional: Inflate/deflate to widen the spread (as suggested by user)
// For this step, we'll calculate the standard deviation for each trait across ALL answers
// and then scale them to a target standard deviation.

const targetStdDev = 2.2; // A good target for a nice spread

traits.forEach(trait => {
    const allScores = [];
    balancedQuestions.forEach(q => {
        q.answers.forEach(a => {
            if (a.scores.hasOwnProperty(trait)) {
                allScores.push(a.scores[trait]);
            }
        });
    });

    // Calculate the current standard deviation for the trait
    const n = allScores.length;
    if (n === 0) return;
    const mean = allScores.reduce((a, b) => a + b) / n;
    const stdDev = Math.sqrt(allScores.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);

    if (stdDev > 0) {
        const scalingFactor = targetStdDev / stdDev;

        // Apply the scaling factor to all scores for this trait
        balancedQuestions.forEach(q => {
            q.answers.forEach(a => {
                if (a.scores.hasOwnProperty(trait)) {
                    const currentScore = a.scores[trait];
                    let scaledScore = currentScore * scalingFactor;
                    // Round to integer and clamp to [-5, 5] as suggested
                    scaledScore = Math.round(scaledScore);
                    scaledScore = Math.max(-5, Math.min(5, scaledScore));
                    a.scores[trait] = scaledScore;
                }
            });
        });
    }
});


// Final check: Let's re-center again after scaling and clamping, as that might shift the mean slightly.
const finalQuestions = balancedQuestions.map(question => {
    const newAnswers = question.answers.map(a => ({ ...a, scores: { ...a.scores } }));

    traits.forEach(trait => {
        let sum = 0;
        let answerCount = 0;
        newAnswers.forEach(answer => {
            if (answer.scores.hasOwnProperty(trait)) {
                sum += answer.scores[trait];
                answerCount++;
            }
        });

        if (answerCount > 0) {
            const mean = sum / answerCount;
            newAnswers.forEach(answer => {
                if (answer.scores.hasOwnProperty(trait)) {
                    // We just subtract the small remaining mean and round to one decimal place
                    answer.scores[trait] = Math.round((answer.scores[trait] - mean) * 10) / 10;
                }
            });
        }
    });

    return { ...question, answers: newAnswers };
});


// Write the balanced questions back to the file
fs.writeFileSync('questions.json', JSON.stringify(finalQuestions, null, 2));

console.log('Successfully re-balanced questions.json');
console.log('The new scores have been mean-centered, scaled, and clamped.');
console.log('A final re-centering pass was applied to ensure question means are as close to zero as possible.');
