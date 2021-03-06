'use strict';

var models = [
    {name: 'Baseline', model: 'baseline', selected: true},
    {name: 'Attention', model: 'attention'},
    {name: 'Coattention', model: 'coattention'},
    {name: 'BiDAF', model: 'bidaf'}
];

var currentModel = models[0];

function getAnswer(query_id, callback) {
    d3.json('data/answers/' + currentModel.model + '/' + query_id + '.json', callback);
}

function createAnswerView() {
    var containerSelection = d3.select('#answer-container');
    var questionSelection = d3.select('span#question');
    var questionTypeSelection = d3.select('span#question-type');
    var answerSelection = d3.select('span#answer');

    return function(query, answer) {
        containerSelection.style('display', 'block');
        questionSelection.text(query.query);
        questionTypeSelection.text(query.query_type);

        var passage = answer.passages
            .find(function(passage) { return passage.selected; });

        if (passage) {
            var answerText = passage.tokens
                .slice(passage.start_index, passage.end_index + 1)
                .join(' ');

            answerSelection.text(answerText);
        } else {
            console.error('no answer found', query, answer);
            answerSelection.text('');
        }
    }
}

function cumSum(array) {
    var sum = [];

    array.reduce(function(a, b, i) {
        return sum[i] = a + b; 
    }, 0);

    return sum;
}

function sample(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function createPassageView() {
    var selection = d3.select('div#passages');

    var buttonContainer = d3.select('#prob-button-container');

    var buttonData = [
        {name: 'Start', colorField: 'startColor'},
        {name: 'In', colorField: 'inColor', selected: true},
        {name: 'End', colorField: 'endColor'}
    ];

    var currentButton = buttonData[1];

    var buttons = buttonContainer
        .selectAll('button')
        .data(buttonData)
        .enter()
        .append('button')
        .text(function(button) { return button.name; })
        .classed('selected', function(button) { return button.selected; });

    return function(query, answer) {
        d3.select('#model-button-container').style('display', 'block');
        var passages = answer.passages;

        function sortKey(passage) {
            return passage.relevance + passage.selected ? 1 : 0;
        }

        passages.sort(function(x, y) {
            return d3.descending(sortKey(x), sortKey(y));
        });

        selection.selectAll('*').remove();

        var passageSelection = selection.selectAll('div.passage')
            .data(passages)
            .enter()
            .append('div')
            .attr('class', 'passage')
            .classed('selected', function(passage) { return passage.selected; });

        var rankContainer = passageSelection.append('div')
            .attr('class', 'rank-container');

        rankContainer.append('p')
            .attr('class', 'relevance')
            .text('Relevance');

        var width = 100,
            height = 20;

        var relevanceScale = d3.scaleLinear()
            .domain(d3.extent(passages.map(function(passage) {
                return passage.relevance;
            })))
            .range([0, width]);

        rankContainer.append('svg')
            .attr('class', 'relevance')
            .attr('width', width)
            .attr('height', height)
            .append('rect')
            .attr('width', function(passage) {
                return relevanceScale(passage.relevance);
            })
            .attr('height', height)
            .attr('x', 0)
            .attr('y', 0)
            .attr('fill', d3.schemeGreens[9][5]);

        var passageContainer = passageSelection.append('div')
            .attr('class', 'passage-container');

        passageContainer.append('a')
            .attr('class', 'passage-link')
            .attr('target', '_blank')
            .attr('href', function(passage) { return passage.url; })
            .text(function(passage) {
                return (new URL(passage.url)).hostname;
            });

        var tokens = passageContainer.append('p')
            .attr('class', 'passage-text')
            .selectAll('span')
            .data(function(passage) {
                function makeScale(values) {
                    return d3.scaleQuantize()
                        .domain(d3.extent(values))
                        .range(d3.schemeGreens[9].slice(0, 5));
                }

                var pStart = cumSum(passage.logits_start);
                var pEnd = cumSum(passage.logits_end);
                var pIn = pStart.map(function(p, i) {
                    return p * (1 - pEnd[i - 1 >= 0 ? i - 1 : 0]);
                });

                var startColorScale = makeScale(passage.logits_start),
                    endColorScale = makeScale(passage.logits_end),
                    inColorScale = makeScale(pIn);

                return passage.tokens.map(function(token, index) {
                    return {
                        token: token,
                        logitStart: passage.logits_start[index],
                        logitEnd: passage.logits_end[index],
                        startColor: startColorScale(passage.logits_start[index]),
                        endColor: endColorScale(passage.logits_end[index]),
                        inColor: inColorScale(pIn[index]),
                        inAnswer: (passage.selected &&
                                   passage.start_index <= index &&
                                   index <= passage.end_index)
                    };
                });
            })
            .enter()
            .append('span')
            .attr('class', 'token')
            .style('background-color', function(token) { return token[currentButton.colorField]; })
            .classed('in-answer', function(token) { return token.inAnswer; })
            .text(function(token, index, tokens, a) {
                return token.token;
            });

        buttonContainer.style('display', 'block');

        buttons
            .on('click', function(button) {
                currentButton = button;

                tokens
                    .style('background-color', function(token) {
                        return token[button.colorField];
                    });

                d3.select(this.parentNode)
                    .selectAll('button')
                    .classed('selected', false);

                d3.select(this)
                    .classed('selected', true);
            });

    };
}

function autocomplete(queries) {
    var MAX_RESULTS = 20;

    var updatePassageView = createPassageView();
    var updateAnswerView = createAnswerView();

    queries = queries.map(function(query) {
        return {
            label: query.query,
            value: query.query_id + 1, // for some reason JQuery doesn't like zero as a value
            type: query.query_type
        };
    });

    var searchBox = $('input#search');

    searchBox.focus();

    function updateSearchBoxValue(event, ui) {
        event.preventDefault();

        if (ui.item) {
            searchBox.val(ui.item.label);
        }
    }

    var currentQuestion;

    function update() {
        getAnswer(currentQuestion.query_id, function(answer) {
            updatePassageView(currentQuestion, answer);
            updateAnswerView(currentQuestion, answer);
        });
    }

    function selectQuestion(autocompleteQuery) {
        currentQuestion = {
            query: autocompleteQuery.label,
            query_id: autocompleteQuery.value - 1,
            query_type: autocompleteQuery.type
        };

        update();
    }

    searchBox.autocomplete({
        delay: 0,
        source: function(request, response) {
            response($.ui.autocomplete.filter(queries, request.term).slice(0, MAX_RESULTS));
        },
        select: function(event, ui) {
            selectQuestion(ui.item);
            updateSearchBoxValue(event, ui);
        },
        change: updateSearchBoxValue,
        focus: updateSearchBoxValue
    });

    d3.select('button#lucky').on('click', function() {
        var query = sample(queries);
        searchBox.val(query.label);
        selectQuestion(query);
    });

    var modelButtonContainer = d3.select('#model-button-container');

    var modelButtons = modelButtonContainer
        .selectAll('button')
        .data(models)
        .enter()
        .append('button')
        .text(function(button) { return button.name; })
        .classed('selected', function(button) { return button.selected; })
        .on('click', function(model) {
            if (model.model != currentModel.model) {
                currentModel = model;
                update();

                d3.select(this.parentNode)
                    .selectAll('button')
                    .classed('selected', false);

                d3.select(this)
                    .classed('selected', true);
            }
        });
}

(function() {
    d3.json('data/queries.json', function(queries) {
        autocomplete(queries);
    });
})();

