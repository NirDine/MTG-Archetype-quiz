$(document).ready(function() {
    let questions = [];
    let traitInfo = {};

    $.when(
        $.getJSON('questions.json'),
        $.getJSON('traits.json')
    ).done(function(questionsData, traitsData) {
        questions = questionsData[0];
        traitInfo = traitsData[0];
        const traits = Object.keys(traitInfo);

        // --- Verification 1: Calculate and display Min/Max possible scores ---
        const scoreRanges = calculateScoreRanges(questions, traits);
        renderScoreRanges(scoreRanges, traitInfo);

        // --- Verification 2: Check that each question's mean is ~0 ---
        const questionAnalysis = analyzeQuestionMeans(questions, traits);
        renderQuestionAnalysis(questionAnalysis);

    }).fail(function() {
        $('#balance-container').html('<p>Error: Could not load JSON data.</p>');
    });

    function calculateScoreRanges(allQuestions, allTraits) {
        const ranges = {};
        allTraits.forEach(trait => {
            ranges[trait] = { min: 0, max: 0 };
        });

        allQuestions.forEach(question => {
            allTraits.forEach(trait => {
                const scoresForTrait = question.answers.map(a => a.scores[trait] || 0);
                const minInQuestion = Math.min(...scoresForTrait);
                const maxInQuestion = Math.max(...scoresForTrait);

                ranges[trait].min += minInQuestion;
                ranges[trait].max += maxInQuestion;
            });
        });

        for (const trait in ranges) {
            ranges[trait].min = Math.round(ranges[trait].min * 100) / 100;
            ranges[trait].max = Math.round(ranges[trait].max * 100) / 100;
        }
        return ranges;
    }

    function analyzeQuestionMeans(allQuestions, allTraits) {
        return allQuestions.map((question, index) => {
            const means = {};
            allTraits.forEach(trait => {
                let sum = 0;
                let count = 0;
                question.answers.forEach(answer => {
                    if (answer.scores.hasOwnProperty(trait)) {
                        sum += answer.scores[trait];
                        count++;
                    }
                });
                means[trait] = count > 0 ? Math.round(sum / count * 1000) / 1000 : 0;
            });
            return {
                question: `Q${index + 1}: ${question.question.substring(0, 30)}...`,
                means: means
            };
        });
    }

    function renderScoreRanges(ranges, traitInfo) {
        const container = $('#ranges-container');
        let content = '<h3>Overall Trait Score Ranges (S_min to S_max)</h3>';

        for (const trait in ranges) {
            const range = ranges[trait];
            content += `<div class="trait-range-row">
                <h4>${trait}</h4>
                <span>Min: <strong>${range.min}</strong></span>
                <span>Max: <strong>${range.max}</strong></span>
                <span>Width: <strong>${Math.round((range.max - range.min) * 100) / 100}</strong></span>
            </div>`;
        }
        container.html(content);
    }

    function renderQuestionAnalysis(analysis) {
        const container = $('#means-container');
        let content = '<h3>Per-Question Trait Mean Analysis (Should be ~0)</h3>';

        analysis.forEach(item => {
            let meansContent = '<div class="means-list">';
            for(const trait in item.means) {
                const meanValue = item.means[trait];
                const isZero = meanValue === 0;
                meansContent += `<span class="mean-item ${isZero ? '' : 'non-zero'}">${trait}: ${meanValue}</span>`;
            }
            meansContent += '</div>';

            content += `<div class="question-analysis-row">
                <p>${item.question}</p>
                ${meansContent}
            </div>`;
        });
        container.html(content);
    }
});
