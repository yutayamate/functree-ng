import datetime, json, os, uuid
import flask, werkzeug.exceptions, cairosvg, subprocess
from functree import app, auth, filters, forms, models, analysis, tree
from .crckm.src import download as crckm


@app.route('/')
def route_index():
    return flask.render_template('index.html')


@app.route('/analysis/<mode>/', methods=['GET', 'POST'])
def route_analysis(mode):
    if mode == 'basic':
        form = forms.BasicForm()
        if form.validate_on_submit():
            result = analysis.perform_basic(
                f=form.input_file.data,
                target=form.target.data
            )
            profile = models.Profile(
                profile_id=uuid.uuid4().hex,
                profile=result['profile'],
                series=result['series'],
                columns=result['columns'],
                target=form.target.data,
                description=form.description.data,
                added_at=datetime.datetime.utcnow(),
                private=form.private.data
            ).save()
            return flask.redirect(flask.url_for('route_viewer') + '?profile_id={}'.format(profile.profile_id))
        else:
            return flask.render_template('analysis.html', form=form, mode=mode)
    elif mode == 'mcr':
        form = forms.McrForm()
        if form.validate_on_submit():
            result = analysis.perform_mcr(
                f=form.input_file.data,
                target=form.target.data
            )
            profile = models.Profile(
                profile_id=uuid.uuid4().hex,
                profile=result['profile'],
                series=result['series'],
                columns=result['columns'],
                target=form.target.data,
                description=form.description.data,
                added_at=datetime.datetime.utcnow(),
                private=form.private.data
            ).save()
            return flask.redirect(flask.url_for('route_viewer') + '?profile_id={}'.format(profile.profile_id))
        else:
            return flask.render_template('analysis.html', form=form, mode=mode)
    elif mode == 'upload_profile':
        form = forms.JsonUploadForm()
        if form.validate_on_submit():
            input_data = json.load(form.input_file.data)[0]
            profile = models.Profile(
                profile_id=uuid.uuid4().hex,
                profile=input_data['profile'],
                series=input_data['series'],
                columns=input_data['columns'],
                target=form.target.data,
                description=form.description.data,
                added_at=datetime.datetime.utcnow(),
                private=form.private.data
            ).save()
            return flask.redirect(flask.url_for('route_viewer') + '?profile_id={}'.format(profile.profile_id))
        else:
            return flask.render_template('analysis.html', form=form, mode=mode)
    else:
        flask.abort(404)


@app.route('/list/')
def route_list():
    profiles = models.Profile.objects().all().filter(private=False)
    return flask.render_template('list.html', **locals())


@app.route('/data/')
def route_data():
    trees = models.Tree.objects().all()
    definitions = models.Definition.objects().all()
    return flask.render_template('data.html', **locals())


@app.route('/help/')
def route_help():
    return flask.render_template('help.html')


@app.route('/about/')
def route_about():
    try:
        version = subprocess.check_output(['git', 'describe', '--long']).decode('utf-8')
    except subprocess.CalledProcessError:
        version = 'v(N/A)'
    return flask.render_template('about.html', **locals())


@app.route('/contact/')
def route_contact():
    return flask.render_template('contact.html')


@app.route('/viewer/')
def route_viewer():
    profile_id = flask.request.args.get('profile_id', type=str)
    mode = flask.request.args.get('mode', default='functree', type=str)
    profile = models.Profile.objects().get_or_404(profile_id=profile_id)
    if mode == 'functree':
        return flask.render_template('functree.html', profile=profile, mode=mode)
    elif mode == 'charts':
        series = flask.request.args.get('series', default=0, type=int)
        return flask.render_template('charts.html', profile=profile, mode=mode, series=series)
    elif mode == 'tables':
        series = flask.request.args.get('series', default=0, type=int)
        return flask.render_template('tables.html', profile=profile, mode=mode, series=series)
    elif mode == 'summary':
        return flask.render_template('summary.html', profile=profile, mode=mode)
    else:
        flask.abort(404)


@app.route('/admin/')
@auth.login_required
def route_admin():
    profiles = models.Profile.objects().all()
    trees = models.Tree.objects().all()
    definitions = models.Definition.objects().all()
    return flask.render_template('admin.html', **locals())


@app.route('/profile/<profile_id>', methods=['GET', 'POST'])
def route_profile(profile_id):
    if flask.request.form.get('_method') == 'DELETE':
        models.Profile.objects.get_or_404(profile_id=profile_id).delete()
        return flask.redirect(flask.url_for('route_list'))
    else:
        profile = models.Profile.objects.get_or_404(profile_id=profile_id)
        return flask.jsonify([profile])


@app.route('/tree/<source>/latest')
def route_tree(source):
    tree = models.Tree.objects().get_or_404(source=source)
    return flask.jsonify([tree])


@app.route('/definition/<source>/latest')
def route_definition(source):
    definition = models.Definition.objects().get_or_404(source=source)
    return flask.jsonify([definition])


@app.route('/action/save_image/', methods=['POST'])
def route_save_image():
    image_format = flask.request.form['format']
    svg = flask.request.form['svg']
    if image_format == 'pdf':
        data = cairosvg.svg2pdf(bytestring=svg)
        mimetype = 'application/pdf'
    elif image_format == 'png':
        data = cairosvg.svg2png(bytestring=svg)
        mimetype = 'image/png'
    elif image_format == 'ps':
        data = cairosvg.svg2ps(bytestring=svg)
        mimetype = 'application/postscript'
    elif image_format == 'svg':
        data = cairosvg.svg2svg(bytestring=svg)
        mimetype = 'image/svg+xml'
    elif image_format == 'raw-svg':
        data = svg
        mimetype = 'image/svg+xml'
    else:
        flask.abort(400)
    return flask.Response(data, mimetype=mimetype)


@app.route('/action/init_profiles/')
@auth.login_required
def route_admin_init_profiles():
    f = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static/data/profile/example.json'), 'r')
    input_data = json.load(f)[0]
    models.Profile.objects.all().delete()
    profile = models.Profile(
        profile_id=uuid.uuid4().hex,
        profile=input_data['profile'],
        series=input_data['series'],
        columns=input_data['columns'],
        target=input_data['target'],
        description=input_data['description'],
        added_at=datetime.datetime.utcnow()
    ).save()
    return flask.redirect(flask.url_for('route_admin'))


@app.route('/action/update_trees/')
@auth.login_required
def route_admin_update_trees():
    models.Tree.objects.all().delete()
    func_tree = models.Tree(
        tree=tree.get_tree(),
        source='KEGG',
        description='KEGG version of Functional Tree',
        added_at=datetime.datetime.utcnow()
    ).save()
    return flask.redirect(flask.url_for('route_admin'))


@app.route('/action/update_definitions/')
@auth.login_required
def route_admin_update_definitions():
    models.Definition.objects.all().delete()
    definition = models.Definition(
        definition=crckm.get_definition(),
        source='KEGG',
        description='KEGG Module definitions',
        added_at=datetime.datetime.utcnow()
    ).save()
    return flask.redirect(flask.url_for('route_admin'))


@auth.get_password
def get_pw(username):
    if username == app.config['FUNCTREE_ADMIN_USERNAME']:
        return app.config['FUNCTREE_ADMIN_PASSWORD']
    return None


@auth.error_handler
def auth_error():
    return flask.render_template('error.html', error=werkzeug.exceptions.Unauthorized()), 401


@app.errorhandler(400)
@app.errorhandler(401)
@app.errorhandler(403)
@app.errorhandler(404)
@app.errorhandler(405)
@app.errorhandler(408)
@app.errorhandler(500)
def route_error(error):
    return flask.render_template('error.html', error=error), error.code