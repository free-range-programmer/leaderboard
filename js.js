/******************************************************************************/
/*** Constants ****************************************************************/
/******************************************************************************/

// google sheets
var URL = 'https://spreadsheets.google.com/feeds/list/1bjT_-YNPEP60dvXaX4SPRoficz7073W9Cf-wZstS97Q/1/public/values?alt=json-in-script&callback=load_JSONP'

/******************************************************************************/
/*** Supplementary Functions **************************************************/
/******************************************************************************/

function _(tag) {
    return document.createElement(tag);
}

function $(id) {
    return document.getElementById(id);
}

function parse(x) {
    if(typeof x !== 'string')
        return 0;
    else
        return parseInt(x);
}

/******************************************************************************/
/*** Main Functions ***********************************************************/
/******************************************************************************/

// compare two PR values
// if PR is an integer -- weight or rounds+reps -- bigger = better
// if PR is a time, smaller = better
function compare_PRs(a, b) {

    var inverse = -1;

    // AMRAP
    score = [a, b].map(function(_) {
        return _.score.match(/^(\d+)\s*(\+\s*(\d+))?$/);
    });

    // nope?
    if(!score[0]) {
        // must be for time
        score = [a, b].map(function(_) {
            return _.score.match(/^(\d{1,3})\s*(:)\s*(\d\d)$/);
        });
        inverse = 1;
    }

    // [rounds, reps], or
    // [min, sec]
    score = [0, 1].map(function(i) {
        return [1, 3].map(function(j) {
            return score[i][j];
        });
    });

    for(var i in [0,0]) {
        if(score[0][i] > score[1][i])
            return inverse;
        if(score[0][i] < score[1][i])
            return -inverse;
    }

    return 0;
}

// download the JSON and run success(data) if everything is OK
function get_JSON(URL) {

    // poor man's CORS
    var script = _('script');
    script.type = 'text/javascript';
    $('loader').appendChild(script);

    // once loaded, destroy the script object, it is no longer necessary
    script.onload = function() {
        this.parentNode.removeChild(this);
    }

    // initiate the request 
    script.src = URL;
}

// create the HTML of the leaderboard for a given WOD
function create_wod_leaderboard(wod_name, wod, cutoff) {

    var div = _('div');
    var table = _('table');

    var athletes = [
        wod['Male'] || [],
        wod['Female'] || [],
        wod['Neither'] || []
    ];

    var gender_titles = [
        'Men',
        'Women',
        'Neither'
    ];

    // find the length of a given WOD plaque
    var length = Math.max.apply(null,
            athletes.map(
                function(_) {
                    return _.length;
                }
            )
        );

    // number of cutoff athletes per category
    if(typeof(cutoff) === 'undefined')
        cutoff = 10;

    // create the gender headers
    var tr = _('tr');
    for(var gender in athletes)
        if(athletes[gender].length) {
            var td = _('td');
            td.setAttribute('colspan', 2);
            tr.appendChild(td).innerHTML = gender_titles[gender];
        }
    table.appendChild(tr);

    for(var i = 0; i < length && i < cutoff; i++) {
        var tr = _('tr');
        for(var gender in athletes) {
            var subgroup = athletes[gender];
            if(subgroup.length) {
                if(i in subgroup) {
                    var a = _('a');
                    a.href = '#' + subgroup[i].athlete;
                    a.innerHTML = subgroup[i].athlete;
                    a.onclick = function() {
                        window.location.reload();
                    };
                    tr.appendChild(_('td')).appendChild(a);
                    tr.appendChild(_('td')).innerHTML = subgroup[i].score;
                }
                else {
                    tr.appendChild(_('td')).innerHTML = '&nbsp';
                    tr.appendChild(_('td')).innerHTML = '&nbsp';
                }
            }
        }
        table.appendChild(tr);
    }

    div.classList.add('wod');
    div.appendChild(_('div')).innerHTML = wod_name;
    div.appendChild(table);

    return div;
}

// crete the HTML for the leaderboard
function create_leaderboard(wods, object, cutoff) {

    // sort the WOD names, for posterity
    var wod_names = [];
    for(var wod_name in wods)
        wod_names.push(wod_name);
    wod_names = wod_names.sort();

    // clear the previous HTML and create new HTML
    object.innerHTML = '';
    for(var i in wod_names)
        object.appendChild(
            create_wod_leaderboard(wod_names[i], wods[wod_names[i]], cutoff)
        );
}

// create the HTML for the individual's PR
function individual_PR(title, score) {
    var div = _('div');
    div.classList.add('individual_pr');
    div.appendChild(_('div')).innerHTML = title;
    div.appendChild(_('div')).innerHTML = score;
    return div;
}

// create individual screen
function create_individual_screen(wods, object) {
    object.innerHTML = '';
    for(var wod in wods)
        object.appendChild(individual_PR(wod, wods[wod][0].score));
}

// pivot the data about WOD, gender, and level
function parse_JSON(json) {

    var wods = {
        'Rx': {},
        'Scaled': {},
        'Lift': {},
    };

    var per_athlete = {};

    var lines = json.feed.entry;

    for(var i = 1; i < lines.length; i++) {

        var wod_name = lines[i].gsx$personalrecord.$t.trim();

        // ignore empty entries
        if(wod_name.length) {

            // gender
            var gender = lines[i].gsx$gender.$t;

            // prescribed is the default
            var level = lines[i].gsx$leveltype.$t || 'Rx';

            if(!(wod_name in wods[level]))
                wods[level][wod_name] = {};
            if(!(gender in wods[level][wod_name]))
                wods[level][wod_name][gender] = [];

            // store the athlete name and score in an appropriate category
            wods[level][wod_name][gender].push({
                timestamp: lines[i].gsx$timestamp.$t,
                score: lines[i].gsx$score.$t.trim(),
                athlete: lines[i].gsx$name.$t.trim()
            });
        }
    }

    // sort
    for(var level in wods)
        for(var wod in wods[level])
            for(var gender in wods[level][wod])
                wods[level][wod][gender] = wods[level][wod][gender].sort(compare_PRs);

    // eliminate duplicate athletes
    for(var level in wods)
        for(wod in wods[level])
            for(var gender in wods[level][wod]) {
                var athletes = {};
                for(var i in wods[level][wod][gender]) {
                    var entry = wods[level][wod][gender][i];
                    var athlete = entry.athlete;

                    if(athlete) {
                        if(!(athlete in per_athlete))
                            per_athlete[athlete] = {};
                        if(!(level in per_athlete[athlete]))
                            per_athlete[athlete][level] = {};
                        if(!(wod in per_athlete[athlete][level]))
                            per_athlete[athlete][level][wod] = [];

                        per_athlete[athlete][level][wod].push({
                            timestamp: entry.timestamp,
                            score: entry.score
                        });
                    }

                    if(athlete in athletes)
                        wods[level][wod][gender].splice(i, 1);
                    else
                        athletes[athlete] = true;
                }
        }

    return {
        wods: wods,
        athletes: per_athlete
    };
}

// callback function for the JSONP request
function load_JSONP(json) {
    var results = parse_JSON(json);

    // #stuff from the URL
    var hash = window.location.hash.substr(1).trim();
    var cutoff = parseInt(hash);
    if(!isFinite(cutoff) || cutoff < 1)
        cutoff = 5;

    if(hash.length && hash.match(/\D/)) {
        var a = _('a');
        a.href = '';
        a.innerHTML = hash;
        a.onclick = function() {
            window.location.reload();
        }

        $('rx_title').innerHTML = '';
        $('rx_title').appendChild(a);
        $('scaled_title').innerHTML = '';
        $('lift_title').innerHTML = '';
        create_individual_screen(results.athletes[hash]['Rx'], $('rx'));
        create_individual_screen(results.athletes[hash]['Scaled'], $('scaled'));
        create_individual_screen(results.athletes[hash]['Lift'], $('lift'));
        $('back').classList.remove('hidden');
        $('back').onclick = function() {
            window.location = '';
            window.reload();
        }
    }
    else {
        create_leaderboard(results.wods['Rx'], $('rx'), cutoff);
        create_leaderboard(results.wods['Scaled'], $('scaled'), cutoff);
        create_leaderboard(results.wods['Lift'], $('lift'), cutoff);
    }
}

// initiate a 60-second refresh cycle
function show_leaderboard() {
    get_JSON(URL);
    window.setTimeout(show_leaderboard, 60000);
}

// show the leaderboard on load;
window.onload = show_leaderboard;
