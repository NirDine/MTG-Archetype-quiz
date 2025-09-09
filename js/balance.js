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

        const totalScores = calculateTotalScores(questions, traits);
        renderBalanceBars(totalScores, traitInfo);
    }).fail(function() {
        $('#trait-bars-container').html('<p>Error: Could not load JSON data. Please make sure questions.json and traits.json are available.</p>');
    });

    function calculateTotalScores(allQuestions, traits) {
        const scores = traits.reduce((acc, trait) => ({ ...acc, [trait]: 0 }), {});

        allQuestions.forEach(question => {
            question.answers.forEach(answer => {
                for (const trait in answer.scores) {
                    if (scores.hasOwnProperty(trait)) {
                        scores[trait] += answer.scores[trait];
                    }
                }
            });
        });

        return scores;
    }

    function renderBalanceBars(scores, traitInfo) {
        const container = $('#trait-bars-container');
        const traits = Object.keys(scores).sort();

        let content = '<h3>Trait Balance Analysis</h3>';

        traits.forEach(trait => {
            const rawScore = scores[trait];
            // Define a max score for scaling. Let's use 50 as a reasonable default max.
            // This means a score of +50 fills the bar right, and -50 fills it left.
            const maxAbsScore = 50;

            // Calculate position: 0 score is 50%. Clamp to prevent overflow.
            let positionPercent = 50 + (rawScore / maxAbsScore) * 50;
            positionPercent = Math.max(0, Math.min(100, positionPercent));

            const info = traitInfo[trait] || {};
            const labels = info.labels || { left: 'Low', right: 'High' };
            const description = `Total Score: ${rawScore}. ${info.description || ''}`;

            let trailLeft, trailWidth;
            if (positionPercent >= 50) {
                trailLeft = 50;
                trailWidth = positionPercent - 50;
            } else {
                trailLeft = positionPercent;
                trailWidth = 50 - positionPercent;
            }

            content += `
                <div class="trait-bar-row">
                    <div class="trait-header">
                        <h4>${trait}</h4>
                        <div class="tooltip">
                            <span class="tooltip-icon">?</span>
                            <div class="tooltip-content">
                                <p>${description}</p>
                            </div>
                        </div>
                    </div>
                    <div class="bar-track">
                        <div class="bar-trail" style="left: ${trailLeft}%; width: ${trailWidth}%;"></div>
                        <div class="bar-indicator" style="left: ${positionPercent}%;"></div>
                    </div>
                    <div class="bar-labels">
                        <span class="label-left">${labels.left}</span>
                        <span class="label-right">${labels.right}</span>
                    </div>
                </div>
            `;
        });
        container.html(content);
    }
});
