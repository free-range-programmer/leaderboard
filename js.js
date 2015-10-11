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
function create_wod_leaderboard(wod_name, wod, top) {

    var div = _('div');
    var table = _('table');

    var men = wod['Male'] || [];
    var women = wod['Female'] || [];

    // number of top athletes per category
    if(typeof(top) === 'undefined')
        top = 5;

    for(var i = 0; i < Math.max(men.length, women.length) && i < top; i++) {
        var tr = _('tr');
        tr.appendChild(_('td')).innerHTML = i in men ? men[i].athlete : '&nbsp';
        tr.appendChild(_('td')).innerHTML = i in men ? men[i].score : '&nbsp';
        tr.appendChild(_('td')).innerHTML = i in women ? women[i].athlete : '&nbsp';
        tr.appendChild(_('td')).innerHTML = i in women ? women[i].score : '&nbsp';
        table.appendChild(tr);
    }

    div.classList.add('wod');
    div.appendChild(_('div')).innerHTML = wod_name;
    div.appendChild(table);

    return div;
}

// crete the HTML for the leaderboard
function create_leaderboard(wods, object) {

    // sort the WOD names, for posterity
    var wod_names = [];
    for(var wod_name in wods)
        wod_names.push(wod_name);
    wod_names = wod_names.sort();

    // clear the previous HTML and create new HTML
    object.innerHTML = '';
    for(var i in wod_names)
        object.appendChild(
            create_wod_leaderboard(wod_names[i], wods[wod_names[i]])
        );
}

// pivot the data about WOD, gender, and level
function parse_JSON(json) {

    var wods = {
        'Rx': {},
        'Scaled': {},
        'Lift': {}
    };

    var lines = json.feed.entry;
    
    for(var i = 1; i < lines.length; i++) {

        var wod_name = lines[i].gsx$personalrecord.$t;
        var gender = lines[i].gsx$gender.$t;

        // prescribed is the default
        var level = lines[i].gsx$leveltype.$t || 'Rx';

        if(!(wod_name in wods[level]))
            wods[level][wod_name] = {};
        if(!(gender in wods[level][wod_name]))
            wods[level][wod_name][gender] = [];

        // store the athlete name and score in an appropriate category
        wods[level][wod_name][gender].push({
            score: lines[i].gsx$score.$t,
            athlete: lines[i].gsx$name.$t
        });
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
                    var athlete = wods[level][wod][gender][i].athlete;
                    if(athlete in athletes)
                        wods[level][wod][gender].splice(i, 1);
                    else
                        athletes[athlete] = true;
                }
        }

    return wods;
}

// callback function for the JSONP request
function load_JSONP(json) {
    var wods = parse_JSON(json);
    create_leaderboard(wods['Rx'], $('rx'));
    create_leaderboard(wods['Scaled'], $('scaled'));
    create_leaderboard(wods['Lift'], $('lift'));
}

// initiate a 60-second refresh cycle
function show_leaderboard() {
    get_JSON(URL);
    window.setTimeout(show_leaderboard, 60000);
}

// show the leaderboard on load;
window.onload = show_leaderboard;
