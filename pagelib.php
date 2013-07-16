<?php

// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle. If not, see <http://www.gnu.org/licenses/>.

/**
 * This file contains several classes uses to render the diferent pages
 * of the socialwiki module
 *
 * @package mod-socialwiki-2.0
 * @copyrigth 2009 Marc Alier, Jordi Piguillem marc.alier@upc.edu
 * @copyrigth 2009 Universitat Politecnica de Catalunya http://www.upc.edu
 *
 * @author Jordi Piguillem
 * @author Marc Alier
 * @author David Jimenez
 * @author Josep Arus
 * @author Daniel Serrano
 * @author Kenneth Riba
 *
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once($CFG->dirroot . '/mod/socialwiki/edit_form.php');
require_once($CFG->dirroot . '/tag/lib.php');

/**
 * Class page_socialwiki contains the common code between all pages
 *
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
abstract class page_socialwiki {

    /**
     * @var object Current subwiki
     */
    protected $subwiki;

    /**
     * @var int Current page
     */
    protected $page;

    /**
     * @var string Current page title
     */
    protected $title;

    /**
     * @var int Current group ID
     */
    protected $gid;

    /**
     * @var object module context object
     */
    protected $modcontext;

    /**
     * @var int Current user ID
     */
    protected $uid;
    /**
     * @var array The tabs set used in wiki module
     */
    protected $tabs = array('view' => 'view', 'edit' => 'edit', 'comments' => 'comments',
                            'versions' => 'history','manage' => 'manage');
    /**
     * @var array tabs options
     */
    protected $tabs_options = array();
    /**
     * @var object wiki renderer
     */
    protected $wikioutput;

    protected $style;

    /**
     * page_socialwiki constructor
     *
     * @param $wiki. Current wiki
     * @param $subwiki. Current subwiki.
     * @param $cm. Current course_module.
     */
    function __construct($wiki, $subwiki, $cm) {
        global $PAGE, $CFG;
		$PAGE->requires->js(new moodle_url("/mod/socialwiki/toolbar.js"));
        $this->subwiki = $subwiki;
        $this->modcontext = context_module::instance($PAGE->cm->id);
        // initialise wiki renderer
        $this->wikioutput = $PAGE->get_renderer('mod_socialwiki');
        $PAGE->set_cacheable(true);
        $PAGE->set_cm($cm);
        $PAGE->set_activity_record($wiki);
		$PAGE->requires->jquery();
        $this->style = socialwiki_get_currentstyle($wiki->id);
        $PAGE->requires->css(new moodle_url("/mod/socialwiki/".$this->style->style."_style.css"));
        // the search box
        $PAGE->set_button(socialwiki_search_form($cm));
    }

    /**
     * This method prints the top of the page.
     */
    function print_header() {
        global $OUTPUT, $PAGE, $CFG, $USER, $SESSION;

        $PAGE->set_heading(format_string($PAGE->course->fullname));

        $this->set_url();

        if (isset($SESSION->socialwikipreviousurl) && is_array($SESSION->socialwikipreviousurl)) {
            $this->process_session_url();
        }
        $this->set_session_url();

        $this->create_navbar();
        $this->setup_tabs();
     
		$html = $OUTPUT->header();
        echo $html;

		if (isset($this->page) && $this->style->style != 'classic')
		{
			$wiki_renderer = $PAGE->get_renderer('mod_socialwiki');
			echo $wiki_renderer->pretty_navbar($this->page->id);
		}

        //echo $this->wikioutput->socialwiki_info();
        //print_object(array_keys($GLOBALS));
        // tabs are associated with pageid, so if page is empty, tabs should be disabled
        if (!empty($this->page) && !empty($this->tabs) && $this->style->style == 'classic') {
            if (socialwiki_liked($USER->id, $this->page->id))
            {
                $this->tabs['like'] = 'unlike';
            }else
            {
                $this->tabs['like'] = 'like';
            }
            $userto = socialwiki_get_author($this->page->id);
            if (socialwiki_is_following($USER->id,$userto->userid,$this->page->subwikiid))
            {
                $this->tabs['follow'] = 'unfollow';
            }
            else
            {
                $this->tabs['follow'] = 'follow';
            }
            echo $this->wikioutput->tabs($this->page, $this->tabs, $this->tabs_options);
        }
    }

    /**
     * Protected method to print current page title.
     */
    protected function print_pagetitle() {
        global $OUTPUT;
        $html = '';

        $html .= $OUTPUT->container_start();
        $html .= $OUTPUT->heading(format_string($this->title), 2, 'socialwiki_headingtitle');
        $html .= $OUTPUT->container_end();
        echo $html;
    }

    /**
     * Setup page tabs, if options is empty, will set up active tab automatically
     * @param array $options, tabs options
     */
    protected function setup_tabs($options = array()) {
        global $CFG, $PAGE;
        $groupmode = groups_get_activity_groupmode($PAGE->cm);

        if (empty($CFG->usecomments) || !has_capability('mod/socialwiki:viewcomment', $PAGE->context)){
            unset($this->tabs['comments']);
        }

        if (!has_capability('mod/socialwiki:editpage', $PAGE->context)){
            unset($this->tabs['edit']);
        }

        if ($groupmode and $groupmode == VISIBLEGROUPS) {
            $currentgroup = groups_get_activity_group($PAGE->cm);
            $manage = has_capability('mod/socialwiki:managewiki', $PAGE->cm->context);
            $edit = has_capability('mod/socialwiki:editpage', $PAGE->context);
            if (!$manage and !($edit and groups_is_member($currentgroup))) {
                unset($this->tabs['edit']);
            }
        }

        if (empty($options)) {
            $this->tabs_options = array('activetab' => substr(get_class($this), 10));
        } else {
            $this->tabs_options = $options;
        }

    }

    /**
     * This method must be overwritten to print the page content.
     */
    function print_content() {
        throw new coding_exception('Page socialwiki class does not implement method print_content()');
    }

    /**
     * Method to set the current page
     *
     * @param object $page Current page
     */
    function set_page($page) {
        global $PAGE;

        $this->page = $page;
        $this->title = $page->title;
        // set_title calls format_string itself so no probs there
        $PAGE->set_title($this->title);
    }

    /**
     * Method to set the current page title.
     * This method must be called when the current page is not created yet.
     * @param string $title Current page title.
     */
    function set_title($title) {
        global $PAGE;
        $this->page = null;
        $this->title = $title;
        // set_title calls format_string itself so no probs there
        $PAGE->set_title($this->title);
    }

    /**
     * Method to set current group id
     * @param int $gid Current group id
     */
    function set_gid($gid) {
        $this->gid = $gid;
    }

    /**
     * Method to set current user id
     * @param int $uid Current user id
     */
    function set_uid($uid) {
        $this->uid = $uid;
    }

    /**
     * Method to set the URL of the page.
     * This method must be overwritten by every type of page.
     */
    protected function set_url() {
        throw new coding_exception('Page socialwiki class does not implement method set_url()');
    }

    /**
     * Protected method to create the common items of the navbar in every page type.
     */
    protected function create_navbar() {
        global $PAGE, $CFG;

        $PAGE->navbar->add(format_string($this->title), $CFG->wwwroot . '/mod/socialwiki/view.php?pageid=' . $this->page->id);
    }

    /**
     * This method print the footer of the page.
     */
    function print_footer() {
        global $OUTPUT;
        echo $OUTPUT->footer();
    }

    protected function process_session_url() {
        global $USER, $SESSION;

        //delete locks if edit
        $url = $SESSION->wikipreviousurl;
        switch ($url['page']) {
        case 'edit':
            socialwiki_delete_locks($url['params']['pageid'], $USER->id, $url['params']['section'], false);
            break;
        }
    }

    protected function set_session_url() {
        global $SESSION;
        unset($SESSION->wikipreviousurl);
    }

}

/**
 * View a socialwiki page
 *
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class page_socialwiki_view extends page_socialwiki {
    /**
     * @var int the coursemodule id
     */
    private $coursemodule;

    function print_header() {
        global $PAGE;

        parent::print_header();

        $this->wikioutput->socialwiki_print_subwiki_selector($PAGE->activityrecord, $this->subwiki, $this->page, 'view');

        if (!empty($this->page)) {
            //echo $this->wikioutput->prettyview_link($this->page);
        }

        //echo $this->wikioutput->page_index();

        //$this->print_pagetitle();
    }
	
	protected function print_pagetitle() {
        global $OUTPUT,$PAGE;
		$user = socialwiki_get_user_info($this->page->userid);
		$userlink = new moodle_url('/user/view.php', array('id' => $user->id, 'course' => $PAGE->cm->course));
		$html = '';

        $html .= $OUTPUT->container_start('','socialwiki_title');
        $html .= $OUTPUT->heading(format_string($this->title), 2, 'socialwiki_headingtitle','viewtitle');
		$html .=$OUTPUT->container_start('userinfo','author');
		$html.=html_writer::link($userlink->out(false),fullname($user));
		$html .= $OUTPUT->container_end();
		$html .= $OUTPUT->container_end();
        echo $html;
    }
    function print_content() {
        global $PAGE, $CFG;

        if (socialwiki_user_can_view($this->subwiki)) {

            if (!empty($this->page)) {
                socialwiki_print_page_content($this->page, $this->modcontext, $this->subwiki->id);
            	echo $this->wikioutput->prettyview_link($this->page);
                $wiki = $PAGE->activityrecord;
            } else {
                print_string('nocontent', 'socialwiki');
                // TODO: fix this part
                $swid = 0;
                if (!empty($this->subwiki)) {
                    $swid = $this->subwiki->id;
                }
            }
        } else {
            echo get_string('cannotviewpage', 'socialwiki');
        }
    }

    function set_url() {
        global $PAGE, $CFG;
        $params = array();

        if (isset($this->coursemodule)) {
            $params['id'] = $this->coursemodule;
        } else if (!empty($this->page) and $this->page != null) {
            $params['pageid'] = $this->page->id;
        } else if (!empty($this->gid)) {
            $params['wid'] = $PAGE->cm->instance;
            $params['group'] = $this->gid;
        } else if (!empty($this->title)) {
            $params['swid'] = $this->subwiki->id;
            $params['title'] = $this->title;
        } else {
            print_error(get_string('invalidparameters', 'socialwiki'));
        }

        $PAGE->set_url(new moodle_url($CFG->wwwroot . '/mod/socialwiki/view.php', $params));
    }

    function set_coursemodule($id) {
        $this->coursemodule = $id;
    }

    protected function create_navbar() {
        global $PAGE;

        $PAGE->navbar->add(format_string($this->title));
        $PAGE->navbar->add(get_string('view', 'socialwiki'));
    }
}

/**
 * Wiki page editing page
 *
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class page_socialwiki_edit extends page_socialwiki {

    public static $attachmentoptions;

    protected $sectioncontent;
    /** @var string the section name needed to be edited */
    protected $section;
    protected $overridelock = false;
    protected $versionnumber = -1;
    protected $upload = false;
    protected $attachments = 0;
    protected $deleteuploads = array();
    protected $format;
	protected $makenew;

    function __construct($wiki, $subwiki, $cm, $makenew) {
        global $CFG, $PAGE;
        parent::__construct($wiki, $subwiki, $cm);
	 	$this->makenew = $makenew;
        self::$attachmentoptions = array('subdirs' => false, 'maxfiles' => - 1, 'maxbytes' => $CFG->maxbytes, 'accepted_types' => '*');
        $PAGE->requires->js_init_call('M.mod_socialwiki.renew_lock', null, true);
    }

    protected function print_pagetitle() {
        global $OUTPUT;

        $title = $this->title;
        if (isset($this->section)) {
            $title .= ' : ' . $this->section;
        }
        echo $OUTPUT->container_start('socialwiki_clear');
        echo $OUTPUT->heading(format_string($title), 2, 'socialwiki_headingtitle');
        echo $OUTPUT->container_end();
    }

    function print_header() {
        global $OUTPUT, $PAGE;
        $PAGE->requires->data_for_js('socialwiki', array('renew_lock_timeout' => SOCIALLOCK_TIMEOUT - 5, 'pageid' => $this->page->id, 'section' => $this->section));       
	parent::print_header();
        $this->print_pagetitle();
        print '<noscript>' . $OUTPUT->box(get_string('javascriptdisabledlocks', 'socialwiki'), 'errorbox') . '</noscript>';
    }

    function print_content() {
        global $PAGE;

        if (socialwiki_user_can_edit($this->subwiki)) {
            $this->print_edit();
        } else {
            echo get_string('cannoteditpage', 'socialwiki');
        }
    }

    protected function set_url() {
        global $PAGE, $CFG;

        $params = array('pageid' => $this->page->id);

        if (isset($this->section)) {
            $params['section'] = $this->section;
        }
		$params['makenew'] = $this->makenew;
        $PAGE->set_url($CFG->wwwroot . '/mod/socialwiki/edit.php'.'?makenew='.$this->makenew, $params);
    }

    protected function set_session_url() {
        global $SESSION;

        $SESSION->wikipreviousurl = array('page' => 'edit', 'params' => array('pageid' => $this->page->id, 'section' => $this->section));
    }

    protected function process_session_url() {
    }

    function set_section($sectioncontent, $section) {
        $this->sectioncontent = $sectioncontent;
        $this->section = $section;
    }

    public function set_versionnumber($versionnumber) {
        $this->versionnumber = $versionnumber;
    }

    public function set_overridelock($override) {
        $this->overridelock = $override;
    }

    function set_format($format) {
        $this->format = $format;
    }

    public function set_upload($upload) {
        $this->upload = $upload;
    }

    public function set_attachments($attachments) {
        $this->attachments = $attachments;
    }

    public function set_deleteuploads($deleteuploads) {
        $this->deleteuploads = $deleteuploads;
    }

    protected function create_navbar() {
        global $PAGE, $CFG;

        parent::create_navbar();

        $PAGE->navbar->add(get_string('edit', 'socialwiki'));
    }

    protected function check_locks() {
        global $OUTPUT, $USER, $CFG;

        if (!socialwiki_set_lock($this->page->id, $USER->id, $this->section, true)) {
            print $OUTPUT->box(get_string('pageislocked', 'socialwiki'), 'generalbox boxwidthnormal boxaligncenter');

            if ($this->overridelock) {
                $params = 'pageid=' . $this->page->id;

                if ($this->section) {
                    $params .= '&section=' . urlencode($this->section);
                }

                $form = '<form method="post" action="' . $CFG->wwwroot . '/mod/socialwiki/overridelocks.php?' . $params . '">';
                $form .= '<input type="hidden" name="sesskey" value="' . sesskey() . '" />';
                $form .= '<input type="submit" value="' . get_string('overridelocks', 'socialwiki') . '" />';
                $form .= '</form>';

                print $OUTPUT->box($form, 'generalbox boxwidthnormal boxaligncenter');
            }
            return false;
        }
        return true;
    }

    protected function print_edit($content = null) {
        global $CFG, $OUTPUT, $USER, $PAGE;

        if (!$this->check_locks()) {
            return;
        }

        //delete old locks (> 1 hour)
        socialwiki_delete_old_locks();
        $version = socialwiki_get_current_version($this->page->id);
        $format = $version->contentformat;

        if ($content == null) {
            if (empty($this->section)) {
                $content = $version->content;
            } else {
                $content = $this->sectioncontent;
            }
        }

        $versionnumber = $version->version;
        if ($this->versionnumber >= 0) {
            if ($version->version != $this->versionnumber) {
                print $OUTPUT->box(get_string('wrongversionlock', 'socialwiki'), 'errorbox');
                $versionnumber = $this->versionnumber;
            }
        }
        $url = $CFG->wwwroot . '/mod/socialwiki/edit.php?pageid=' . $this->page->id.'&makenew='.$this->makenew;
        if (!empty($this->section)) {
            $url .= "&section=" . urlencode($this->section);
        }

        $params = array(
            'attachmentoptions' => page_socialwiki_edit::$attachmentoptions,
            'format' => $version->contentformat,
            'version' => $versionnumber,
            'pagetitle' => $this->page->title,
            'contextid' => $this->modcontext->id
        );

        $data = new StdClass();
        $data->newcontent = $content;
        $data->version = $versionnumber;
        $data->format = $format;

        switch ($format) {
        case 'html':
            $data->newcontentformat = FORMAT_HTML;
            // Append editor context to editor options, giving preference to existing context.
            page_socialwiki_edit::$attachmentoptions = array_merge(array('context' => $this->modcontext), page_socialwiki_edit::$attachmentoptions);
            $data = file_prepare_standard_editor($data, 'newcontent', page_socialwiki_edit::$attachmentoptions, $this->modcontext, 'mod_socialwiki', 'attachments', $this->subwiki->id);
            break;
        default:
            break;
        }

        if ($version->contentformat != 'html') {
            $params['fileitemid'] = $this->subwiki->id;
            $params['component']  = 'mod_socialwiki';
            $params['filearea']   = 'attachments';
        }
        if (!empty($CFG->usetags)) {
            $params['tags'] = tag_get_tags_csv('socialwiki_pages', $this->page->id, TAG_RETURN_TEXT);
        }

        $form = new mod_socialwiki_edit_form($url, $params);

        if ($formdata = $form->get_data()) {
            if (!empty($CFG->usetags)) {
                $data->tags = $formdata->tags;
            }
        } else {
            if (!empty($CFG->usetags)) {
                $data->tags = tag_get_tags_array('socialwiki', $this->page->id);
            }
        }

        $form->set_data($data);
        $form->display();
    }

}

/**
 * Class that models the behavior of wiki's view comments page
 *
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class page_socialwiki_comments extends page_socialwiki {

    function print_header() {

        parent::print_header();

        $this->print_pagetitle();

    }

    function print_content() {
        global $CFG, $OUTPUT, $USER, $PAGE;
        require_once($CFG->dirroot . '/mod/socialwiki/locallib.php');

        $page = $this->page;
        $subwiki = $this->subwiki;
        $wiki = $PAGE->activityrecord;
        list($context, $course, $cm) = get_context_info_array($this->modcontext->id);

        require_capability('mod/socialwiki:viewcomment', $this->modcontext, NULL, true, 'noviewcommentpermission', 'socialwiki');

        $comments = socialwiki_get_comments($this->modcontext->id, $page->id);

        if (has_capability('mod/socialwiki:editcomment', $this->modcontext)) {
            echo '<div class="midpad"><a href="' . $CFG->wwwroot . '/mod/socialwiki/editcomments.php?action=add&amp;pageid=' . $page->id . '">' . get_string('addcomment', 'socialwiki') . '</a></div>';
        }

        $options = array('swid' => $this->page->subwikiid, 'pageid' => $page->id);
        $version = socialwiki_get_current_version($this->page->id);
        $format = $version->contentformat;

        if (empty($comments)) {
            echo $OUTPUT->heading(get_string('nocomments', 'socialwiki'));
        }

        foreach ($comments as $comment) {

            $user = socialwiki_get_user_info($comment->userid);

            $fullname = fullname($user, has_capability('moodle/site:viewfullnames', context_course::instance($course->id)));
            $by = new stdclass();
            $by->name = '<a href="' . $CFG->wwwroot . '/user/view.php?id=' . $user->id . '&amp;course=' . $course->id . '">' . $fullname . '</a>';
            $by->date = userdate($comment->timecreated);

            $t = new html_table();
            $cell1 = new html_table_cell($OUTPUT->user_picture($user, array('popup' => true)));
            $cell2 = new html_table_cell(get_string('bynameondate', 'forum', $by));
            $cell3 = new html_table_cell();
            $cell3->atributtes ['width'] = "80%";
            $cell4 = new html_table_cell();
            $cell5 = new html_table_cell();

            $row1 = new html_table_row();
            $row1->cells[] = $cell1;
            $row1->cells[] = $cell2;
            $row2 = new html_table_row();
            $row2->cells[] = $cell3;

            if ($format != 'html') {
                if ($format == 'creole') {
                    $parsedcontent = socialwiki_parse_content('creole', $comment->content, $options);
                } else if ($format == 'nwiki') {
                    $parsedcontent = socialwiki_parse_content('nwiki', $comment->content, $options);
                }

                $cell4->text = format_text(html_entity_decode($parsedcontent['parsed_text'], ENT_QUOTES, 'UTF-8'), FORMAT_HTML);
            } else {
                $cell4->text = format_text($comment->content, FORMAT_HTML);
            }

            $row2->cells[] = $cell4;

            $t->data = array($row1, $row2);

            $actionicons = false;
            if ((has_capability('mod/socialwiki:managecomment', $this->modcontext))) {
                $urledit = new moodle_url('/mod/socialwiki/editcomments.php', array('commentid' => $comment->id, 'pageid' => $page->id, 'action' => 'edit'));
                $urldelet = new moodle_url('/mod/socialwiki/instancecomments.php', array('commentid' => $comment->id, 'pageid' => $page->id, 'action' => 'delete'));
                $actionicons = true;
            } else if ((has_capability('mod/socialwiki:editcomment', $this->modcontext)) and ($USER->id == $user->id)) {
                $urledit = new moodle_url('/mod/socialwiki/editcomments.php', array('commentid' => $comment->id, 'pageid' => $page->id, 'action' => 'edit'));
                $urldelet = new moodle_url('/mod/socialwiki/instancecomments.php', array('commentid' => $comment->id, 'pageid' => $page->id, 'action' => 'delete'));
                $actionicons = true;
            }

            if ($actionicons) {
                $cell6 = new html_table_cell($OUTPUT->action_icon($urledit, new pix_icon('t/edit', get_string('edit'),
                        '', array('class' => 'iconsmall'))) . $OUTPUT->action_icon($urldelet, new pix_icon('t/delete',
                        get_string('delete'), '', array('class' => 'iconsmall'))));
                $row3 = new html_table_row();
                $row3->cells[] = $cell5;
                $row3->cells[] = $cell6;
                $t->data[] = $row3;
            }

            echo html_writer::tag('div', html_writer::table($t), array('class'=>'no-overflow'));

        }
    }

    function set_url() {
        global $PAGE, $CFG;
        $PAGE->set_url($CFG->wwwroot . '/mod/socialwiki/comments.php', array('pageid' => $this->page->id));
    }

    protected function create_navbar() {
        global $PAGE, $CFG;

        parent::create_navbar();
        $PAGE->navbar->add(get_string('comments', 'socialwiki'));
    }

}

/**
 * Class that models the behavior of wiki's edit comment
 *
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class page_socialwiki_editcomment extends page_socialwiki {
    private $comment;
    private $action;
    private $form;
    private $format;

    function set_url() {
        global $PAGE, $CFG;
        $PAGE->set_url($CFG->wwwroot . '/mod/socialwiki/comments.php', array('pageid' => $this->page->id));
    }

    function print_header() {
        parent::print_header();
        $this->print_pagetitle();
    }

    function print_content() {
        global $PAGE;

        require_capability('mod/socialwiki:editcomment', $this->modcontext, NULL, true, 'noeditcommentpermission', 'socialwiki');

        if ($this->action == 'add') {
            $this->add_comment_form();
        } else if ($this->action == 'edit') {
            $this->edit_comment_form($this->comment);
        }
    }

    function set_action($action, $comment) {
        global $CFG;
        require_once($CFG->dirroot . '/mod/socialwiki/comments_form.php');

        $this->action = $action;
        $this->comment = $comment;
        $version = socialwiki_get_current_version($this->page->id);
        $this->format = $version->contentformat;

        if ($this->format == 'html') {
            $destination = $CFG->wwwroot . '/mod/socialwiki/instancecomments.php?pageid=' . $this->page->id;
            $this->form = new mod_socialwiki_comments_form($destination);
        }
    }

    protected function create_navbar() {
        global $PAGE, $CFG;

        $PAGE->navbar->add(get_string('comments', 'socialwiki'), $CFG->wwwroot . '/mod/socialwiki/comments.php?pageid=' . $this->page->id);

        if ($this->action == 'add') {
            $PAGE->navbar->add(get_string('insertcomment', 'socialwiki'));
        } else {
            $PAGE->navbar->add(get_string('editcomment', 'socialwiki'));
        }
    }

    protected function setup_tabs($options = array()) {
        parent::setup_tabs(array('linkedwhenactive' => 'comments', 'activetab' => 'comments'));
    }

    private function add_comment_form() {
        global $CFG;
        require_once($CFG->dirroot . '/mod/socialwiki/editors/socialwiki_editor.php');

        $pageid = $this->page->id;

        if ($this->format == 'html') {
            $com = new stdClass();
            $com->action = 'add';
            $com->commentoptions = array('trusttext' => true, 'maxfiles' => 0);
            $this->form->set_data($com);
            $this->form->display();
        } else {
            socialwiki_print_editor_wiki($this->page->id, null, $this->format, -1, null, false, null, 'addcomments');
        }
    }

    private function edit_comment_form($com) {
        global $CFG;
        require_once($CFG->dirroot . '/mod/socialwiki/comments_form.php');
        require_once($CFG->dirroot . '/mod/socialwiki/editors/socialwiki_editor.php');

        if ($this->format == 'html') {
            $com->action = 'edit';
            $com->entrycomment_editor['text'] = $com->content;
            $com->commentoptions = array('trusttext' => true, 'maxfiles' => 0);

            $this->form->set_data($com);
            $this->form->display();
        } else {
            socialwiki_print_editor_wiki($this->page->id, $com->content, $this->format, -1, null, false, array(), 'editcomments', $com->id);
        }

    }

}

/**
 * Wiki page search page
 *
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class page_socialwiki_search extends page_socialwiki {
    private $search_result;
	private $search_string;

    protected function create_navbar() {
        global $PAGE, $CFG;

        $PAGE->navbar->add(format_string($this->title));
    }

	function __construct($wiki, $subwiki, $cm)
	{
		global $PAGE;
		parent::__construct($wiki, $subwiki, $cm);
		$PAGE->requires->js(new moodle_url("/mod/socialwiki/tree_jslib/tree.js"));
		$PAGE->requires->css(new moodle_url("/mod/socialwiki/tree_jslib/tree_styles.css"));
		$PAGE->requires->js(new moodle_url("/mod/socialwiki/search.js"));
	}

    function set_search_string($search, $searchcontent) {
        $swid = $this->subwiki->id;
		$this->search_string = $search;
        if ($searchcontent) {
            $this->search_result = socialwiki_search_all($swid, $search);
        } else {
            $this->search_result = socialwiki_search_title($swid, $search);
        }

    }

    function set_url() {
        global $PAGE, $CFG;
        $PAGE->set_url($CFG->wwwroot . '/mod/socialwiki/search.php');
    }
    function print_content() {
        global $PAGE,$OUTPUT;
		
        require_capability('mod/socialwiki:viewpage', $this->modcontext, NULL, true, 'noviewpagepermission', 'socialwiki');
		
		echo $this->wikioutput->content_area_begin();
		echo $this->wikioutput->title_block("Search results for: ".$this->search_string."(".count($this->search_result)."&nbsptotal)");
        //echo $this->wikioutput->search_result($this->search_result, $this->subwiki);
		$tree= new socialwiki_tree();
		//create a tree from the search results
        foreach($this->search_result as $page){
			$tree->add_node($page);
		}
		//display the php tree (this is hidden if JavaScript is enabled)
		echo $OUTPUT->container_start('phptree');
		$tree->display();
		echo $OUTPUT->container_end();

		echo $this->wikioutput->content_area_end();
		$json=json_encode($tree);
		//send the tree to javascript
		echo '<script> var searchResults='.$json.';</script>';

    }
}

/**
 *
 * Class that models the behavior of wiki's
 * create page
 *
 */
class page_socialwiki_create extends page_socialwiki {

    private $format;
    private $swid;
    private $wid;
    private $action;
    private $mform;
    private $groups;

    function print_header() {
        $this->set_url();
        parent::print_header();
    }

    function set_url() {
        global $PAGE, $CFG;

        $params = array();
        $params['swid'] = $this->swid;
        if ($this->action == 'new') {
            $params['action'] = 'new';
            $params['wid'] = $this->wid;
            if ($this->title != get_string('newpage', 'socialwiki')) {
                $params['title'] = $this->title;
            }
        } else {
            $params['action'] = 'create';
        }
        $PAGE->set_url(new moodle_url('/mod/socialwiki/create.php', $params));
    }

    function set_format($format) {
        $this->format = $format;
    }

    function set_wid($wid) {
        $this->wid = $wid;
    }

    function set_swid($swid) {
        $this->swid = $swid;
    }

    function set_availablegroups($group) {
        $this->groups = $group;
    }

    function set_action($action) {
        global $PAGE;
        $this->action = $action;

        require_once(dirname(__FILE__) . '/create_form.php');
        $url = new moodle_url('/mod/socialwiki/create.php', array('action' => 'create', 'wid' => $PAGE->activityrecord->id, 'group' => $this->gid, 'uid' => $this->uid));
        $formats = socialwiki_get_formats();
        $options = array('formats' => $formats, 'defaultformat' => $PAGE->activityrecord->defaultformat, 'forceformat' => $PAGE->activityrecord->forceformat, 'groups' => $this->groups);
        if ($this->title != get_string('newpage', 'socialwiki')) {
            $options['disable_pagetitle'] = true;
        }
        $this->mform = new mod_socialwiki_create_form($url->out(false), $options);
    }

    protected function create_navbar() {
        global $PAGE;
        // navigation_node::get_content formats this before printing.
        $PAGE->navbar->add($this->title);
    }

    function print_content($pagetitle = '') {
        global $PAGE;

        // @TODO: Change this to has_capability and show an alternative interface.
        require_capability('mod/socialwiki:createpage', $this->modcontext, NULL, true, 'nocreatepermission', 'socialwiki');
        $data = new stdClass();
        if (!empty($pagetitle)) {
            $data->pagetitle = $pagetitle;
        }
        $data->pageformat = $PAGE->activityrecord->defaultformat;

        $this->mform->set_data($data);
        $this->mform->display();
    }

    function create_page($pagetitle) {
        global $USER, $PAGE;

        $data = $this->mform->get_data();
        if (isset($data->groupinfo)) {
            $groupid = $data->groupinfo;
        } else if (!empty($this->gid)) {
            $groupid = $this->gid;
        } else {
            $groupid = '0';
        }
        if (empty($this->subwiki)) {
            // If subwiki is not set then try find one and set else create one.
            if (!$this->subwiki = socialwiki_get_subwiki_by_group($this->wid, $groupid, $this->uid)) {
                $swid = socialwiki_add_subwiki($PAGE->activityrecord->id, $groupid, $this->uid);
                $this->subwiki = socialwiki_get_subwiki($swid);
            }
        }
        if ($data) {
            $this->set_title($data->pagetitle);
            $id = socialwiki_create_page($this->subwiki->id, $data->pagetitle, $data->pageformat, $USER->id);
        } else {
            $this->set_title($pagetitle);
            $id = socialwiki_create_page($this->subwiki->id, $pagetitle, $PAGE->activityrecord->defaultformat, $USER->id);
        }
        $this->page = $id;
        return $id;
    }
}

class page_socialwiki_preview extends page_socialwiki_edit {

    private $newcontent;

    function __construct($wiki, $subwiki, $cm) {
        global $PAGE, $CFG, $OUTPUT;
        parent::__construct($wiki, $subwiki, $cm, 0);
        $buttons = $OUTPUT->update_module_button($cm->id, 'socialwiki');
        $PAGE->set_button($buttons);

    }

    function print_header() {
        global $PAGE, $CFG;

        parent::print_header();

    }

    function print_content() {
        global $PAGE;

        require_capability('mod/socialwiki:editpage', $this->modcontext, NULL, true, 'noeditpermission', 'socialwiki');

        $this->print_preview();
    }

    function set_newcontent($newcontent) {
        $this->newcontent = $newcontent;
    }

    function set_url() {
        global $PAGE, $CFG;

        $params = array('pageid' => $this->page->id
        );

        if (isset($this->section)) {
            $params['section'] = $this->section;
        }

        $PAGE->set_url($CFG->wwwroot . '/mod/socialwiki/edit.php', $params);
    }

    protected function setup_tabs($options = array()) {
        parent::setup_tabs(array('linkedwhenactive' => 'view', 'activetab' => 'view'));
    }

    protected function check_locks() {
        return true;
    }

    protected function print_preview() {
        global $CFG, $PAGE, $OUTPUT;

        $version = socialwiki_get_current_version($this->page->id);
        $format = $version->contentformat;
        $content = $version->content;

        $url = $CFG->wwwroot . '/mod/socialwiki/edit.php?pageid=' . $this->page->id;
        if (!empty($this->section)) {
            $url .= "&section=" . urlencode($this->section);
        }
        $params = array(
            'attachmentoptions' => page_socialwiki_edit::$attachmentoptions,
            'format' => $this->format,
            'version' => $this->versionnumber,
            'contextid' => $this->modcontext->id
        );

        if ($this->format != 'html') {
            $params['component'] = 'mod_socialwiki';
            $params['filearea'] = 'attachments';
            $params['fileitemid'] = $this->page->id;
        }
        $form = new mod_socialwiki_edit_form($url, $params);


        $options = array('swid' => $this->page->subwikiid, 'pageid' => $this->page->id, 'pretty_print' => true);

        if ($data = $form->get_data()) {
            if (isset($data->newcontent)) {
                // wiki fromat
                $text = $data->newcontent;
            } else {
                // html format
                $text = $data->newcontent_editor['text'];
            }
            $parseroutput = socialwiki_parse_content($data->contentformat, $text, $options);
            $this->set_newcontent($text);
            echo $OUTPUT->notification(get_string('previewwarning', 'socialwiki'), 'notifyproblem socialwiki_info');
            $content = format_text($parseroutput['parsed_text'], FORMAT_HTML, array('overflowdiv'=>true, 'filter'=>false));
            echo $OUTPUT->box($content, 'generalbox socialwiki_previewbox');
            $content = $this->newcontent;
        }

        $this->print_edit($content);
    }

}

/**
 *
 * Class that models the behavior of wiki's
 * view differences
 *
 */
class page_socialwiki_diff extends page_socialwiki {

    private $compare;
    private $comparewith;

    function print_header() {
        global $OUTPUT;

        parent::print_header();

        $this->print_pagetitle();
        $vstring = new stdClass();
        $vstring->old = $this->compare;
        $vstring->new = $this->comparewith;
        echo $OUTPUT->heading(get_string('comparewith', 'socialwiki', $vstring));
    }

    /**
     * Print the diff view
     */
    function print_content() {
        global $PAGE;

        require_capability('mod/socialwiki:viewpage', $this->modcontext, NULL, true, 'noviewpagepermission', 'socialwiki');

        $this->print_diff_content();
    }

    function set_url() {
        global $PAGE, $CFG;

        $PAGE->set_url($CFG->wwwroot . '/mod/socialwiki/diff.php', array('pageid' => $this->page->id, 'comparewith' => $this->comparewith, 'compare' => $this->compare));
    }

    function set_comparison($compare, $comparewith) {
        $this->compare = $compare;
        $this->comparewith = $comparewith;
    }

    protected function create_navbar() {
        global $PAGE, $CFG;

        parent::create_navbar();
        $PAGE->navbar->add(get_string('history', 'socialwiki'), $CFG->wwwroot . '/mod/socialwiki/history.php?pageid=' . $this->page->id);
        $PAGE->navbar->add(get_string('diff', 'socialwiki'));
	}
     /**
     * Given two , prints a page displaying the differences between them.
     *
     * @global object $CFG
     * @global object $OUTPUT
     * @global object $PAGE
     */
    private function print_diff_content() {
        global $CFG, $OUTPUT, $PAGE;

        $pageid = $this->page->id;
        $total = socialwiki_count_wiki_page_versions($pageid) - 1;

        $oldversion = socialwiki_get_wiki_page_version($this->compare,1 );

        $newversion = socialwiki_get_wiki_page_version($this->comparewith,1 );

        if ($oldversion && $newversion) {

            $oldtext = format_text(file_rewrite_pluginfile_urls($oldversion->content, 'pluginfile.php', $this->modcontext->id, 'mod_socialwiki', 'attachments', $this->subwiki->id));
            $newtext = format_text(file_rewrite_pluginfile_urls($newversion->content, 'pluginfile.php', $this->modcontext->id, 'mod_socialwiki', 'attachments', $this->subwiki->id));
            list($diff1, $diff2) = ouwiki_diff_html($oldtext, $newtext);
            $oldversion->diff = $diff1;
            $oldversion->user = socialwiki_get_user_info($oldversion->userid);
            $newversion->diff = $diff2;
            $newversion->user = socialwiki_get_user_info($newversion->userid);

            echo $this->wikioutput->diff($pageid, $oldversion, $newversion, array('total' => $total));
        } else {
            print_error('versionerror', 'socialwiki');
        }
    }
}

/**
 *
 * Class that models the behavior of wiki's history page
 *
 */
class page_socialwiki_history extends page_socialwiki {
    /**
     * @var int $paging current page
     */
    private $paging;

    /**
     * @var int @rowsperpage Items per page
     */
    private $rowsperpage = 10;

    /**
     * @var int $allversion if $allversion != 0, all versions will be printed in a signle table
     */
    private $allversion;

    function __construct($wiki, $subwiki, $cm) {
        global $PAGE;
        parent::__construct($wiki, $subwiki, $cm);
        $PAGE->requires->js_init_call('M.mod_socialwiki.history', null, true);
		$PAGE->requires->jquery();
		$PAGE->requires->js(new moodle_url("/mod/socialwiki/tree_jslib/tree.js"));
		$PAGE->requires->css(new moodle_url("/mod/socialwiki/tree_jslib/tree_styles.css"));
		$PAGE->requires->js(new moodle_url("/mod/socialwiki/history.js"));
    }

    function print_header() {
        parent::print_header();
    }

    function print_content() {
        global $PAGE,$OUTPUT;


        require_capability('mod/socialwiki:viewpage', $this->modcontext, NULL, true, 'noviewpagepermission', 'socialwiki');
		$history=socialwiki_get_relations($this->page->id);
		$tree=new socialwiki_tree();
		foreach($history as $page){
		$tree->add_node($page);
		}

		foreach($tree->nodes as $node){
		$node->content .= "<br/>";
		$node->content.=$this->choose_from_radio(array(substr($node->id,1) => null), 'compare', 'M.mod_socialwiki.history()', '', true). $this->choose_from_radio(array(substr($node->id,1) => null), 'comparewith', 'M.mod_socialwiki.history()', '', true);

		}
		echo $this->wikioutput->content_area_begin();
		echo $this->wikioutput->title_block($this->title);

		echo html_writer::start_tag('form', array('action'=>new moodle_url('/mod/socialwiki/diff.php'), 'method'=>'get', 'id'=>'diff'));
		echo html_writer::tag('div', html_writer::empty_tag('input', array('type'=>'hidden', 'name'=>'pageid', 'value'=>$this->page->id)));
		echo $OUTPUT->container_start('phptree');		
		$tree->display();
		echo $OUTPUT->container_end();
		echo $OUTPUT->container_start('socialwiki_diffbutton');
		echo html_writer::empty_tag('input', array('type'=>'submit', 'class'=>'socialwiki_form-button', 'value'=>get_string('comparesel', 'socialwiki')));
		echo $OUTPUT->container_end();
		echo html_writer::end_tag('form');
		echo $this->wikioutput->content_area_end();
		$json=json_encode($tree);
		//send the tree to javascript

		echo '<script> var searchResults='.$json.';</script>';

    }

    function set_url() {
        global $PAGE, $CFG;
        $PAGE->set_url($CFG->wwwroot . '/mod/socialwiki/history.php', array('pageid' => $this->page->id));
    }

    function set_paging($paging) {
        $this->paging = $paging;
    }

    function set_allversion($allversion) {
        $this->allversion = $allversion;
    }

    protected function create_navbar() {
        global $PAGE, $CFG;

        parent::create_navbar();
        $PAGE->navbar->add(get_string('history', 'socialwiki'));
    }

    /**
     * Prints the history for a given wiki page
     *
     * @global object $CFG
     * @global object $OUTPUT
     * @global object $PAGE
     */
    private function print_history_content() {
        global $CFG, $OUTPUT, $PAGE;

        $pageid = $this->page->id;
        $offset = $this->paging * $this->rowsperpage;
        // vcount is the latest version
        $vcount = socialwiki_count_wiki_page_versions($pageid) - 1;
        if ($this->allversion) {
            $versions = socialwiki_get_wiki_page_versions($pageid, 0, $vcount);
        } else {
            $versions = socialwiki_get_wiki_page_versions($pageid, $offset, $this->rowsperpage);
        }
        // We don't want version 0 to be displayed
        // version 0 is blank page
        if (end($versions)->version == 0) {
            array_pop($versions);
        }

        $contents = array();

        $version0page = socialwiki_get_wiki_page_version($this->page->id, 0);
        $creator = socialwiki_get_user_info($version0page->userid);
        $a = new StdClass;
        $a->date = userdate($this->page->timecreated, get_string('strftimedaydatetime', 'langconfig'));
        $a->username = fullname($creator);
        echo $OUTPUT->heading(get_string('createddate', 'socialwiki', $a), 4, 'socialwiki_headingtime');
        if ($vcount > 0) {

            /// If there is only one version, we don't need radios nor forms
            if (count($versions) == 1) {

                $row = array_shift($versions);

                $username = socialwiki_get_user_info($row->userid);
                $picture = $OUTPUT->user_picture($username);
                $date = userdate($row->timecreated, get_string('strftimedate', 'langconfig'));
                $time = userdate($row->timecreated, get_string('strftimetime', 'langconfig'));
                $versionid = socialwiki_get_version($row->id);
                $versionlink = new moodle_url('/mod/socialwiki/viewversion.php', array('pageid' => $pageid, 'versionid' => $versionid->id));
                $userlink = new moodle_url('/user/view.php', array('id' => $username->id, 'course' => $PAGE->cm->course));
                $contents[] = array('', html_writer::link($versionlink->out(false), $row->version), $picture . html_writer::link($userlink->out(false), fullname($username)), $time, $OUTPUT->container($date, 'socialwiki_histdate'));

                $table = new html_table();
                $table->head = array('', get_string('version'), get_string('user'), get_string('modified'), '');
                $table->data = $contents;
                $table->attributes['class'] = 'mdl-align';

                echo html_writer::table($table);

            } else {

                $checked = $vcount - $offset;
                $rowclass = array();

                foreach ($versions as $version) {
                    $user = socialwiki_get_user_info($version->userid);
                    $picture = $OUTPUT->user_picture($user, array('popup' => true));
                    $date = userdate($version->timecreated, get_string('strftimedate'));
                    $rowclass[] = 'socialwiki_histnewdate';
                    $time = userdate($version->timecreated, get_string('strftimetime', 'langconfig'));
                    $versionid = socialwiki_get_version($version->id);
                    if ($versionid) {
                        $url = new moodle_url('/mod/socialwiki/viewversion.php', array('pageid' => $pageid, 'versionid' => $versionid->id));
                        $viewlink = html_writer::link($url->out(false), $version->version);
                    } else {
                        $viewlink = $version->version;
                    }
                    $userlink = new moodle_url('/user/view.php', array('id' => $version->userid, 'course' => $PAGE->cm->course));
                    $contents[] = array($this->choose_from_radio(array($version->version  => null), 'compare', 'M.mod_socialwiki.history()', $checked - 1, true) . $this->choose_from_radio(array($version->version  => null), 'comparewith', 'M.mod_socialwiki.history()', $checked, true), $viewlink, $picture . html_writer::link($userlink->out(false), fullname($user)), $time, $OUTPUT->container($date, 'socialwiki_histdate'));
                }

                $table = new html_table();

                $icon = $OUTPUT->help_icon('diff', 'socialwiki');

                $table->head = array(get_string('diff', 'socialwiki') . $icon, get_string('version'), get_string('user'), get_string('modified'), '');
                $table->data = $contents;
                $table->attributes['class'] = 'generaltable mdl-align';
                $table->rowclasses = $rowclass;

                // Print the form.
                echo html_writer::start_tag('form', array('action'=>new moodle_url('/mod/socialwiki/diff.php'), 'method'=>'get', 'id'=>'diff'));
                echo html_writer::tag('div', html_writer::empty_tag('input', array('type'=>'hidden', 'name'=>'pageid', 'value'=>$pageid)));
                echo html_writer::table($table);
                echo html_writer::start_tag('div', array('class'=>'mdl-align'));
                echo html_writer::empty_tag('input', array('type'=>'submit', 'class'=>'socialwiki_form-button', 'value'=>get_string('comparesel', 'socialwiki')));
                echo html_writer::end_tag('div');
                echo html_writer::end_tag('form');
            }
        } else {
            print_string('nohistory', 'socialwiki');
        }
        if (!$this->allversion) {
            //$pagingbar = moodle_paging_bar::make($vcount, $this->paging, $this->rowsperpage, $CFG->wwwroot.'/mod/socialwiki/history.php?pageid='.$pageid.'&amp;');
            // $pagingbar->pagevar = $pagevar;
            echo $OUTPUT->paging_bar($vcount, $this->paging, $this->rowsperpage, $CFG->wwwroot . '/mod/socialwiki/history.php?pageid=' . $pageid . '&amp;');
            //print_paging_bar($vcount, $paging, $rowsperpage,$CFG->wwwroot.'/mod/socialwiki/history.php?pageid='.$pageid.'&amp;','paging');
            } else {
            $link = new moodle_url('/mod/socialwiki/history.php', array('pageid' => $pageid));
            $OUTPUT->container(html_writer::link($link->out(false), get_string('viewperpage', 'socialwiki', $this->rowsperpage)), 'mdl-align');
        }
        if ($vcount > $this->rowsperpage && !$this->allversion) {
            $link = new moodle_url('/mod/socialwiki/history.php', array('pageid' => $pageid, 'allversion' => 1));
            $OUTPUT->container(html_writer::link($link->out(false), get_string('viewallhistory', 'socialwiki')), 'mdl-align');
        }
    }

    /**
     * Given an array of values, creates a group of radio buttons to be part of a form
     *
     * @param array  $options  An array of value-label pairs for the radio group (values as keys).
     * @param string $name     Name of the radiogroup (unique in the form).
     * @param string $onclick  Function to be executed when the radios are clicked.
     * @param string $checked  The value that is already checked.
     * @param bool   $return   If true, return the HTML as a string, otherwise print it.
     *
     * @return mixed If $return is false, returns nothing, otherwise returns a string of HTML.
     */
    private function choose_from_radio($options, $name, $onclick = '', $checked = '', $return = false) {

        static $idcounter = 0;

        if (!$name) {
            $name = 'unnamed';
        }

        $output = '<span class="radiogroup ' . $name . "\">\n";

        if (!empty($options)) {
            $currentradio = 0;
            foreach ($options as $value => $label) {
                $htmlid = 'auto-rb' . sprintf('%04d', ++$idcounter);
                $output .= ' <span class="radioelement ' . $name . ' rb' . $currentradio . "\">";
                $output .= '<input form = "diff" name="' . $name . '" id="' . $htmlid . '" type="radio" value="' . $value . '"';
                if ($value == $checked) {
                    $output .= ' checked="checked"';
                }
                if ($onclick) {
                    $output .= ' onclick="' . $onclick . '"';
                }
                if ($label === '') {
                    $output .= ' /> <label for="' . $htmlid . '">' . $value . '</label></span>' . "\n";
                } else {
                    $output .= ' /> <label for="' . $htmlid . '">' . $label . '</label></span>' . "\n";
                }
                $currentradio = ($currentradio + 1) % 2;
            }
        }

        $output .= '</span>' . "\n";

        if ($return) {
            return $output;
        } else {
            echo $output;
        }
    }
}

/**
 * Class that models the behavior of wiki's map page
 *
 */
class page_socialwiki_map extends page_socialwiki {

    /**
     * @var int wiki view option
     */
    private $view;

    function print_header() {
        parent::print_header();
        $this->print_pagetitle();
    }

    function print_content() {
        global $CFG, $PAGE;

        require_capability('mod/socialwiki:viewpage', $this->modcontext, NULL, true, 'noviewpagepermission', 'socialwiki');

        if ($this->view > 0) {
            //echo '<div><a href="' . $CFG->wwwroot . '/mod/socialwiki/map.php?pageid=' . $this->page->id . '">' . get_string('backtomapmenu', 'socialwiki') . '</a></div>';
        }

        switch ($this->view) {
        case 1:
            echo $this->wikioutput->menu_map($this->page->id, $this->view);
            $this->print_contributions_content();
            break;
        case 2:
            echo $this->wikioutput->menu_map($this->page->id, $this->view);
            $this->print_navigation_content();
            break;
        case 3:
            echo $this->wikioutput->menu_map($this->page->id, $this->view);
            $this->print_orphaned_content();
            break;
        case 4:
            echo $this->wikioutput->menu_map($this->page->id, $this->view);
            $this->print_index_content();
            break;
        case 5:
            echo $this->wikioutput->menu_map($this->page->id, $this->view);
            $this->print_page_list_content();
            break;
        case 6:
            echo $this->wikioutput->menu_map($this->page->id, $this->view);
            $this->print_updated_content();
            break;
        default:
            echo $this->wikioutput->menu_map($this->page->id, $this->view);
            $this->print_page_list_content();
        }
    }

    function set_view($option) {
        $this->view = $option;
    }

    function set_url() {
        global $PAGE, $CFG;
        $PAGE->set_url($CFG->wwwroot . '/mod/socialwiki/map.php', array('pageid' => $this->page->id));
    }

    protected function create_navbar() {
        global $PAGE;

        parent::create_navbar();
        $PAGE->navbar->add(get_string('map', 'socialwiki'));
    }

    /**
     * Prints the contributions tab content
     *
     * @uses $OUTPUT, $USER
     *
     */
    private function print_contributions_content() {
        global $CFG, $OUTPUT, $USER;
        $page = $this->page;

        if ($page->timerendered + SOCIALWIKI_REFRESH_CACHE_TIME < time()) {
            $fresh = wiki_refresh_cachedcontent($page);
            $page = $fresh['page'];
        }

        $swid = $this->subwiki->id;

        $table = new html_table();
        $table->head = array(get_string('contributions', 'socialwiki') . $OUTPUT->help_icon('contributions', 'socialwiki'));
        $table->attributes['class'] = 'socialwiki_editor generalbox';
        $table->data = array();
        $table->rowclasses = array();

        $lastversions = array();
        $pages = array();
        $users = array();

        if ($contribs = socialwiki_get_contributions($swid, $USER->id)) {
            foreach ($contribs as $contrib) {
                if (!array_key_exists($contrib->pageid, $pages)) {
                    $page = socialwiki_get_page($contrib->pageid);
                    $pages[$contrib->pageid] = $page;
                } else {
                    continue;
                }

                if (!array_key_exists($page->id, $lastversions)) {
                    $version = socialwiki_get_last_version($page->id);
                    $lastversions[$page->id] = $version;
                } else {
                    $version = $lastversions[$page->id];
                }

                if (!array_key_exists($version->userid, $users)) {
                    $user = socialwiki_get_user_info($version->userid);
                    $users[$version->userid] = $user;
                } else {
                    $user = $users[$version->userid];
                }

                $link = socialwiki_parser_link($page->title, array('swid' => $swid));
                $class = ($link['new']) ? 'class="socialwiki_newentry"' : '';

                $linkpage = '<a href="' . $link['url'] . '"' . $class . '>' . format_string($link['content'], true, array('context' => $this->modcontext)) . '</a>';
                $icon = $OUTPUT->user_picture($user, array('popup' => true));

                $table->data[] = array("$icon&nbsp;$linkpage");
            }
        } else {
            $table->data[] = array(get_string('nocontribs', 'socialwiki'));
        }
        echo html_writer::table($table);
    }

    /**
     * Prints the navigation tab content
     *
     * @uses $OUTPUT
     *
     */
    private function print_navigation_content() {
        global $OUTPUT;
        $page = $this->page;

        if ($page->timerendered + SOCIALWIKI_REFRESH_CACHE_TIME < time()) {
            $fresh = socialwiki_refresh_cachedcontent($page);
            $page = $fresh['page'];
        }

        $tolinks = socialwiki_get_linked_to_pages($page->id);
        $fromlinks = socialwiki_get_linked_from_pages($page->id);

        $table = new html_table();
        $table->attributes['class'] = 'socialwiki_navigation_from';
        $table->head = array(get_string('navigationfrom', 'socialwiki') . $OUTPUT->help_icon('navigationfrom', 'socialwiki') . ':');
        $table->data = array();
        $table->rowclasses = array();
        foreach ($fromlinks as $link) {
            $lpage = socialwiki_get_page($link->frompageid);
            $link = new moodle_url('/mod/socialwiki/view.php', array('pageid' => $lpage->id));
            $table->data[] = array(html_writer::link($link->out(false), format_string($lpage->title)));
            $table->rowclasses[] = 'mdl-align';
        }

        $table_left = html_writer::table($table);

        $table = new html_table();
        $table->attributes['class'] = 'socialwiki_navigation_to';
        $table->head = array(get_string('navigationto', 'socialwiki') . $OUTPUT->help_icon('navigationto', 'socialwiki') . ':');
        $table->data = array();
        $table->rowclasses = array();
        foreach ($tolinks as $link) {
            if ($link->tomissingpage) {
                $viewlink = new moodle_url('/mod/socialwiki/create.php', array('swid' => $page->subwikiid, 'title' => $link->tomissingpage, 'action' => 'new'));
                $table->data[] = array(html_writer::link($viewlink->out(false), format_string($link->tomissingpage), array('class' => 'socialwiki_newentry')));
            } else {
                $lpage = socialwiki_get_page($link->topageid);
                $viewlink = new moodle_url('/mod/socialwiki/view.php', array('pageid' => $lpage->id));
                $table->data[] = array(html_writer::link($viewlink->out(false), format_string($lpage->title)));
            }
            $table->rowclasses[] = 'mdl-align';
        }
        $table_right = html_writer::table($table);
        echo $OUTPUT->container($table_left . $table_right, 'socialwiki_navigation_container');
    }

    /**
     * Prints the index page tab content
     *
     *
     */
    private function print_index_content() {
        global $OUTPUT;
        $page = $this->page;

        if ($page->timerendered + SOCIALWIKI_REFRESH_CACHE_TIME < time()) {
            $fresh = socialwiki_refresh_cachedcontent($page);
            $page = $fresh['page'];
        }

        // navigation_node get_content calls format string for us
        $node = new navigation_node($page->title);

        $keys = array();
        $tree = array();
        $tree = socialwiki_build_tree($page, $node, $keys);

        $table = new html_table();
        $table->head = array(get_string('pageindex', 'socialwiki') . $OUTPUT->help_icon('pageindex', 'socialwiki'));
        $table->attributes['class'] = 'socialwiki_editor generalbox';
        $table->data[] = array($this->render_navigation_node($tree));

        echo html_writer::table($table);
    }

    /**
     * Prints the page list tab content
     *
     *
     */
    private function print_page_list_content() {
        global $OUTPUT;
        $page = $this->page;

        if ($page->timerendered + SOCIALWIKI_REFRESH_CACHE_TIME < time()) {
            $fresh = socialwiki_refresh_cachedcontent($page);
            $page = $fresh['page'];
        }

        $pages = socialwiki_get_page_list($this->subwiki->id);

        $stdaux = new stdClass();
        $strspecial = get_string('special', 'socialwiki');

        foreach ($pages as $page) {
            // We need to format the title here to account for any filtering
            $letter = format_string($page->title, true, array('context' => $this->modcontext));
            $letter = textlib::substr($letter, 0, 1);
            if (preg_match('/^[a-zA-Z]$/', $letter)) {
                $letter = textlib::strtoupper($letter);
                $stdaux->{$letter}[] = socialwiki_parser_link($page);
            } else {
                $stdaux->{$strspecial}[] = socialwiki_parser_link($page);
            }
        }

        $table = new html_table();
        $table->head = array(get_string('pagelist', 'socialwiki') . $OUTPUT->help_icon('pagelist', 'socialwiki'));
        $table->attributes['class'] = 'socialwiki_editor generalbox';
        $table->align = array('center');
        foreach ($stdaux as $key => $elem) {
            $table->data[] = array($key);
            foreach ($elem as $e) {
                $table->data[] = array(html_writer::link($e['url'], format_string($e['content'], true, array('context' => $this->modcontext))));
            }
        }
        echo html_writer::table($table);
    }

    /**
     * Prints the orphaned tab content
     *
     *
     */
    private function print_orphaned_content() {
        global $OUTPUT;

        $page = $this->page;

        if ($page->timerendered + SOCIALWIKI_REFRESH_CACHE_TIME < time()) {
            $fresh = socialwiki_refresh_cachedcontent($page);
            $page = $fresh['page'];
        }

        $swid = $this->subwiki->id;

        $table = new html_table();
        $table->head = array(get_string('orphaned', 'socialwiki') . $OUTPUT->help_icon('orphaned', 'socialwiki'));
        $table->attributes['class'] = 'socialwiki_editor generalbox';
        $table->data = array();
        $table->rowclasses = array();

        if ($orphanedpages = socialwiki_get_orphaned_pages($swid)) {
            foreach ($orphanedpages as $page) {
                $link = socialwiki_parser_link($page->title, array('swid' => $swid));
                $class = ($link['new']) ? 'class="socialwiki_newentry"' : '';
                $table->data[] = array('<a href="' . $link['url'] . '"' . $class . '>' . format_string($link['content']) . '</a>');
            }
        } else {
            $table->data[] = array(get_string('noorphanedpages', 'socialwiki'));
        }

        echo html_writer::table($table);
    }

    /**
     * Prints the updated tab content
     *
     * @uses $COURSE, $OUTPUT
     *
     */
    private function print_updated_content() {
        global $COURSE, $OUTPUT;
        $page = $this->page;

        if ($page->timerendered + SOCIALWIKI_REFRESH_CACHE_TIME < time()) {
            $fresh = socialwiki_refresh_cachedcontent($page);
            $page = $fresh['page'];
        }

        $swid = $this->subwiki->id;

        $table = new html_table();
        $table->head = array(get_string('updatedpages', 'socialwiki') . $OUTPUT->help_icon('updatedpages', 'socialwiki'));
        $table->attributes['class'] = 'socialwiki_editor generalbox';
        $table->data = array();
        $table->rowclasses = array();

        if ($pages = socialwiki_get_updated_pages_by_subwiki($swid)) {
            $strdataux = '';
            foreach ($pages as $page) {
                $user = socialwiki_get_user_info($page->userid);
                $strdata = strftime('%d %b %Y', $page->timemodified);
                if ($strdata != $strdataux) {
                    $table->data[] = array($OUTPUT->heading($strdata, 4));
                    $strdataux = $strdata;
                }
                $link = socialwiki_parser_link($page->title, array('swid' => $swid));
                $class = ($link['new']) ? 'class="socialwiki_newentry"' : '';

                $linkpage = '<a href="' . $link['url'] . '"' . $class . '>' . format_string($link['content']) . '</a>';
                $icon = $OUTPUT->user_picture($user, array($COURSE->id));
                $table->data[] = array("$icon&nbsp;$linkpage");
            }
        } else {
            $table->data[] = array(get_string('noupdatedpages', 'socialwiki'));
        }

        echo html_writer::table($table);
    }

    protected function render_navigation_node($items, $attrs = array(), $expansionlimit = null, $depth = 1) {

        // exit if empty, we don't want an empty ul element
        if (count($items) == 0) {
            return '';
        }

        // array of nested li elements
        $lis = array();
        foreach ($items as $item) {
            if (!$item->display) {
                continue;
            }
            $content = $item->get_content();
            $title = $item->get_title();
            if ($item->icon instanceof renderable) {
                $icon = $this->wikioutput->render($item->icon);
                $content = $icon . '&nbsp;' . $content; // use CSS for spacing of icons
                }
            if ($item->helpbutton !== null) {
                $content = trim($item->helpbutton) . html_writer::tag('span', $content, array('class' => 'clearhelpbutton'));
            }

            if ($content === '') {
                continue;
            }

            if ($item->action instanceof action_link) {
                //TODO: to be replaced with something else
                $link = $item->action;
                if ($item->hidden) {
                    $link->add_class('dimmed');
                }
                $content = $this->output->render($link);
            } else if ($item->action instanceof moodle_url) {
                $attributes = array();
                if ($title !== '') {
                    $attributes['title'] = $title;
                }
                if ($item->hidden) {
                    $attributes['class'] = 'dimmed_text';
                }
                $content = html_writer::link($item->action, $content, $attributes);

            } else if (is_string($item->action) || empty($item->action)) {
                $attributes = array();
                if ($title !== '') {
                    $attributes['title'] = $title;
                }
                if ($item->hidden) {
                    $attributes['class'] = 'dimmed_text';
                }
                $content = html_writer::tag('span', $content, $attributes);
            }

            // this applies to the li item which contains all child lists too
            $liclasses = array($item->get_css_type(), 'depth_' . $depth);
            if ($item->has_children() && (!$item->forceopen || $item->collapse)) {
                $liclasses[] = 'collapsed';
            }
            if ($item->isactive === true) {
                $liclasses[] = 'current_branch';
            }
            $liattr = array('class' => join(' ', $liclasses));
            // class attribute on the div item which only contains the item content
            $divclasses = array('tree_item');
            if ((empty($expansionlimit) || $item->type != $expansionlimit) && ($item->children->count() > 0 || ($item->nodetype == navigation_node::NODETYPE_BRANCH && $item->children->count() == 0 && isloggedin()))) {
                $divclasses[] = 'branch';
            } else {
                $divclasses[] = 'leaf';
            }
            if (!empty($item->classes) && count($item->classes) > 0) {
                $divclasses[] = join(' ', $item->classes);
            }
            $divattr = array('class' => join(' ', $divclasses));
            if (!empty($item->id)) {
                $divattr['id'] = $item->id;
            }
            $content = html_writer::tag('p', $content, $divattr) . $this->render_navigation_node($item->children, array(), $expansionlimit, $depth + 1);
            if (!empty($item->preceedwithhr) && $item->preceedwithhr === true) {
                $content = html_writer::empty_tag('hr') . $content;
            }
            $content = html_writer::tag('li', $content, $liattr);
            $lis[] = $content;
        }

        if (count($lis)) {
            return html_writer::tag('ul', implode("\n", $lis), $attrs);
        } else {
            return '';
        }
    }

}

/**
 * Class that models the behavior of wiki's restore version page
 *
 */
class page_socialwiki_restoreversion extends page_socialwiki {
    private $version;

    function print_header() {
        parent::print_header();
        $this->print_pagetitle();
    }

    function print_content() {
        global $CFG, $PAGE;

        require_capability('mod/socialwiki:managewiki', $this->modcontext, NULL, true, 'nomanagewikipermission', 'socialwiki');

        $this->print_restoreversion();
    }

    function set_url() {
        global $PAGE, $CFG;
        $PAGE->set_url($CFG->wwwroot . '/mod/socialwiki/viewversion.php', array('pageid' => $this->page->id, 'versionid' => $this->version->id));
    }

    function set_versionid($versionid) {
        $this->version = socialwiki_get_version($versionid);
    }

    protected function create_navbar() {
        global $PAGE, $CFG;

        parent::create_navbar();
        $PAGE->navbar->add(get_string('restoreversion', 'socialwiki'));
    }

    protected function setup_tabs($options = array()) {
        parent::setup_tabs(array('linkedwhenactive' => 'history', 'activetab' => 'history'));
    }

    /**
     * Prints the restore version content
     *
     * @uses $CFG
     *
     * @param page $page The page whose version will be restored
     * @param int  $versionid The version to be restored
     * @param bool $confirm If false, shows a yes/no confirmation page.
     *     If true, restores the old version and redirects the user to the 'view' tab.
     */
    private function print_restoreversion() {
        global $OUTPUT;

        $version = socialwiki_get_version($this->version->id);

        $optionsyes = array('confirm'=>1, 'pageid'=>$this->page->id, 'versionid'=>$version->id, 'sesskey'=>sesskey());
        $restoreurl = new moodle_url('/mod/socialwiki/restoreversion.php', $optionsyes);
        $return = new moodle_url('/mod/socialwiki/viewversion.php', array('pageid'=>$this->page->id, 'versionid'=>$version->id));

        echo $OUTPUT->heading(get_string('restoreconfirm', 'socialwiki', $version->version), 2);
        print_container_start(false, 'socialwiki_restoreform');
        echo '<form class="socialwiki_restore_yes" action="' . $restoreurl . '" method="post" id="restoreversion">';
        echo '<div><input type="submit" name="confirm" value="' . get_string('yes') . '" /></div>';
        echo '</form>';
        echo '<form class="socialwiki_restore_no" action="' . $return . '" method="post">';
        echo '<div><input type="submit" name="norestore" value="' . get_string('no') . '" /></div>';
        echo '</form>';
        print_container_end();
    }
}
/**
 * Class that models the behavior of wiki's delete comment confirmation page
 *
 */
class page_socialwiki_deletecomment extends page_socialwiki {
    private $commentid;

    function print_header() {
        parent::print_header();
        $this->print_pagetitle();
    }

    function print_content() {
        $this->printconfirmdelete();
    }

    function set_url() {
        global $PAGE;
        $PAGE->set_url('/mod/socialwiki/instancecomments.php', array('pageid' => $this->page->id, 'commentid' => $this->commentid));
    }

    public function set_action($action, $commentid, $content) {
        $this->action = $action;
        $this->commentid = $commentid;
        $this->content = $content;
    }

    protected function create_navbar() {
        global $PAGE;

        parent::create_navbar();
        $PAGE->navbar->add(get_string('deletecommentcheck', 'socialwiki'));
    }

    protected function setup_tabs($options = array()) {
        parent::setup_tabs(array('linkedwhenactive' => 'comments', 'activetab' => 'comments'));
    }

    /**
     * Prints the comment deletion confirmation form
     *
     * @param page $page The page whose version will be restored
     * @param int  $versionid The version to be restored
     * @param bool $confirm If false, shows a yes/no confirmation page.
     *     If true, restores the old version and redirects the user to the 'view' tab.
     */
    private function printconfirmdelete() {
        global $OUTPUT;

        $strdeletecheck = get_string('deletecommentcheck', 'socialwiki');
        $strdeletecheckfull = get_string('deletecommentcheckfull', 'socialwiki');

        //ask confirmation
        $optionsyes = array('confirm'=>1, 'pageid'=>$this->page->id, 'action'=>'delete', 'commentid'=>$this->commentid, 'sesskey'=>sesskey());
        $deleteurl = new moodle_url('/mod/socialwiki/instancecomments.php', $optionsyes);
        $return = new moodle_url('/mod/socialwiki/comments.php', array('pageid'=>$this->page->id));

        echo $OUTPUT->heading($strdeletecheckfull);
        print_container_start(false, 'socialwiki_deletecommentform');
        echo '<form class="socialwiki_deletecomment_yes" action="' . $deleteurl . '" method="post" id="deletecomment">';
        echo '<div><input type="submit" name="confirmdeletecomment" value="' . get_string('yes') . '" /></div>';
        echo '</form>';
        echo '<form class="socialwiki_deletecomment_no" action="' . $return . '" method="post">';
        echo '<div><input type="submit" name="norestore" value="' . get_string('no') . '" /></div>';
        echo '</form>';
        print_container_end();
    }
}

/**
 * Class that models the behavior of socialwiki's
 * save page
 *
 */
class page_socialwiki_save extends page_socialwiki_edit {

    private $newcontent;

    function print_header() {
    }

    function print_content() {
        global $PAGE;

        $context = context_module::instance($PAGE->cm->id);
        require_capability('mod/socialwiki:editpage', $context, NULL, true, 'noeditpermission', 'socialwiki');

        $this->print_save();
    }

    function set_newcontent($newcontent) {
        $this->newcontent = $newcontent;
    }

    protected function set_session_url() {
    }

    protected function print_save() {
        global $CFG, $USER, $OUTPUT, $PAGE;

        $url = $CFG->wwwroot . '/mod/socialwiki/edit.php?pageid=' . $this->page->id.'&makenew='.$this->makenew;
        if (!empty($this->section)) {
            $url .= "&section=" . urlencode($this->section);
        }

        $params = array(
            'attachmentoptions' => page_socialwiki_edit::$attachmentoptions,
            'format' => $this->format,
            'version' => $this->versionnumber,
            'contextid' => $this->modcontext->id,
        );

        if ($this->format != 'html') {
            $params['fileitemid'] = $this->page->id;
            $params['component']  = 'mod_socialwiki';
            $params['filearea']   = 'attachments';
        }

        $form = new mod_socialwiki_edit_form($url, $params);

        $save = false;
        $data = false;
        if ($data = $form->get_data()) {
            if ($this->format == 'html') {
                $data = file_postupdate_standard_editor($data, 'newcontent', page_socialwiki_edit::$attachmentoptions, $this->modcontext, 'mod_socialwiki', 'attachments', $this->subwiki->id);
            }

            if (isset($this->section)) {
                $save = socialwiki_save_section($this->page, $this->section, $data->newcontent, $USER->id);
            } else {
                $save = socialwiki_save_page($this->page, $data->newcontent, $USER->id);
            }
        }

        if ($save && $data) {
            if (!empty($CFG->usetags)) {
                tag_set('socialwiki_pages', $this->page->id, $data->tags);
            }

            $message = '<p>' . get_string('saving', 'socialwiki') . '</p>';

            if (!empty($save['sections'])) {
                foreach ($save['sections'] as $s) {
                    $message .= '<p>' . get_string('repeatedsection', 'socialwiki', $s) . '</p>';
                }
            }

            if ($this->versionnumber + 1 != $save['version']) {
                $message .= '<p>' . get_string('wrongversionsave', 'socialwiki') . '</p>';
            }

            if (isset($errors) && !empty($errors)) {
                foreach ($errors as $e) {
                    $message .= "<p>" . get_string('filenotuploadederror', 'socialwiki', $e->get_filename()) . "</p>";
                }
            }

            //deleting old locks
            socialwiki_delete_locks($this->page->id, $USER->id, $this->section);
            $url = new moodle_url('/mod/socialwiki/view.php', array('pageid' => $this->page->id, 'group' => $this->subwiki->groupid));
            redirect($url);
        } else {
            print_error('savingerror', 'socialwiki');
        }
    }
}

/**
 * Class that models the behavior of wiki's view an old version of a page
 *
 */
class page_socialwiki_viewversion extends page_socialwiki {

    private $version;

    function print_header() {
        parent::print_header();
        $this->print_pagetitle();
    }

    function print_content() {
        global $PAGE;

        require_capability('mod/socialwiki:viewpage', $this->modcontext, NULL, true, 'noviewpagepermission', 'socialwiki');

        $this->print_version_view();
    }

    function set_url() {
        global $PAGE, $CFG;
        $PAGE->set_url($CFG->wwwroot . '/mod/socialwiki/viewversion.php', array('pageid' => $this->page->id, 'versionid' => $this->version->id));
    }

    function set_versionid($versionid) {
        $this->version = socialwiki_get_version($versionid);
    }

    protected function create_navbar() {
        global $PAGE, $CFG;

        parent::create_navbar();
        $PAGE->navbar->add(get_string('history', 'socialwiki'), $CFG->wwwroot . '/mod/socialwiki/history.php?pageid=' . $this->page->id);
        $PAGE->navbar->add(get_string('versionnum', 'socialwiki', $this->version->version));
    }

    protected function setup_tabs($options = array()) {
        parent::setup_tabs(array('linkedwhenactive' => 'history', 'activetab' => 'history', 'inactivetabs' => array('edit')));
    }

    /**
     * Given an old page version, output the version content
     *
     * @global object $CFG
     * @global object $OUTPUT
     * @global object $PAGE
     */
    private function print_version_view() {
        global $CFG, $OUTPUT, $PAGE;
        $pageversion = socialwiki_get_version($this->version->id);

        if ($pageversion) {
            $restorelink = new moodle_url('/mod/socialwiki/restoreversion.php', array('pageid' => $this->page->id, 'versionid' => $this->version->id));
            echo $OUTPUT->heading(get_string('viewversion', 'socialwiki', $pageversion->version) . '<br />' . html_writer::link($restorelink->out(false), '(' . get_string('restorethis', 'socialwiki') . ')', array('class' => 'socialwiki_restore')) . '&nbsp;', 4);
            $userinfo = socialwiki_get_user_info($pageversion->userid);
            $heading = '<p><strong>' . get_string('modified', 'socialwiki') . ':</strong>&nbsp;' . userdate($pageversion->timecreated, get_string('strftimedatetime', 'langconfig'));
            $viewlink = new moodle_url('/user/view.php', array('id' => $userinfo->id));
            $heading .= '&nbsp;&nbsp;&nbsp;<strong>' . get_string('user') . ':</strong>&nbsp;' . html_writer::link($viewlink->out(false), fullname($userinfo));
            $heading .= '&nbsp;&nbsp;&rarr;&nbsp;' . $OUTPUT->user_picture(socialwiki_get_user_info($pageversion->userid), array('popup' => true)) . '</p>';
            print_container($heading, false, 'mdl-align socialwiki_modifieduser socialwiki_headingtime');
            $options = array('swid' => $this->subwiki->id, 'pretty_print' => true, 'pageid' => $this->page->id);

            $pageversion->content = file_rewrite_pluginfile_urls($pageversion->content, 'pluginfile.php', $this->modcontext->id, 'mod_socialwiki', 'attachments', $this->subwiki->id);

            $parseroutput = socialwiki_parse_content($pageversion->contentformat, $pageversion->content, $options);
            $content = print_container(format_text($parseroutput['parsed_text'], FORMAT_HTML, array('overflowdiv'=>true)), false, '', '', true);
            echo $OUTPUT->box($content, 'generalbox socialwiki_contentbox');

        } else {
            print_error('versionerror', 'socialwiki');
        }
    }
}

class page_socialwiki_confirmrestore extends page_socialwiki_save {

    private $version;

    function set_url() {
        global $PAGE, $CFG;
        $PAGE->set_url($CFG->wwwroot . '/mod/socialwiki/viewversion.php', array('pageid' => $this->page->id, 'versionid' => $this->version->id));
    }

    function print_content() {
        global $CFG, $PAGE;

        require_capability('mod/socialwiki:managewiki', $this->modcontext, NULL, true, 'nomanagewikipermission', 'socialwiki');

        $version = socialwiki_get_version($this->version->id);
        if (socialwiki_restore_page($this->page, $version->content, $version->userid)) {
            redirect($CFG->wwwroot . '/mod/socialwiki/view.php?pageid=' . $this->page->id, get_string('restoring', 'socialwiki', $version->version), 3);
        } else {
            print_error('restoreerror', 'socialwiki', $version->version);
        }
    }

    function set_versionid($versionid) {
        $this->version = socialwiki_get_version($versionid);
    }
}

class page_socialwiki_prettyview extends page_socialwiki {

    function print_header() {
        global $CFG, $PAGE, $OUTPUT;
        $PAGE->set_pagelayout('embedded');
        echo $OUTPUT->header();

        echo '<h1 id="socialwiki_printable_title">' . format_string($this->title) . '</h1>';
    }

    function print_content() {
        global $PAGE;

        require_capability('mod/socialwiki:viewpage', $this->modcontext, NULL, true, 'noviewpagepermission', 'socialwiki');

        $this->print_pretty_view();
    }

    function set_url() {
        global $PAGE, $CFG;

        $PAGE->set_url($CFG->wwwroot . '/mod/socialwiki/prettyview.php', array('pageid' => $this->page->id));
    }

    private function print_pretty_view() {
        $version = socialwiki_get_current_version($this->page->id);

        $content = socialwiki_parse_content($version->contentformat, $version->content, array('printable' => true, 'swid' => $this->subwiki->id, 'pageid' => $this->page->id, 'pretty_print' => true));

        echo '<div id="socialwiki_printable_content">';
        echo format_text($content['parsed_text'], FORMAT_HTML);
        echo '</div>';
    }
}

class page_socialwiki_handlecomments extends page_socialwiki {
    private $action;
    private $content;
    private $commentid;
    private $format;

    function print_header() {
        $this->set_url();
    }

    public function print_content() {
        global $CFG, $PAGE, $USER;

        if ($this->action == 'add') {
            if (has_capability('mod/socialwiki:editcomment', $this->modcontext)) {
                $this->add_comment($this->content, $this->commentid);
            }
        } else if ($this->action == 'edit') {
            $comment = socialwiki_get_comment($this->commentid);
            $edit = has_capability('mod/socialwiki:editcomment', $this->modcontext);
            $owner = ($comment->userid == $USER->id);
            if ($owner && $edit) {
                $this->add_comment($this->content, $this->commentid);
            }
        } else if ($this->action == 'delete') {
            $comment = socialwiki_get_comment($this->commentid);
            $manage = has_capability('mod/socialwiki:managecomment', $this->modcontext);
            $owner = ($comment->userid == $USER->id);
            if ($owner || $manage) {
                $this->delete_comment($this->commentid);
                redirect($CFG->wwwroot . '/mod/socialwiki/comments.php?pageid=' . $this->page->id, get_string('deletecomment', 'socialwiki'), 2);
            }
        }

    }

    public function set_url() {
        global $PAGE, $CFG;
        $PAGE->set_url($CFG->wwwroot . '/mod/socialwiki/comments.php', array('pageid' => $this->page->id));
    }

    public function set_action($action, $commentid, $content) {
        $this->action = $action;
        $this->commentid = $commentid;
        $this->content = $content;

        $version = socialwiki_get_current_version($this->page->id);
        $format = $version->contentformat;

        $this->format = $format;
    }

    private function add_comment($content, $idcomment) {
        global $CFG, $PAGE;
        require_once($CFG->dirroot . "/mod/socialwiki/locallib.php");

        $pageid = $this->page->id;

        socialwiki_add_comment($this->modcontext, $pageid, $content, $this->format);

        if (!$idcomment) {
            redirect($CFG->wwwroot . '/mod/socialwiki/comments.php?pageid=' . $pageid, get_string('createcomment', 'socialwiki'), 2);
        } else {
            $this->delete_comment($idcomment);
            redirect($CFG->wwwroot . '/mod/socialwiki/comments.php?pageid=' . $pageid, get_string('editingcomment', 'socialwiki'), 2);
        }
    }

    private function delete_comment($commentid) {
        global $CFG, $PAGE;

        $pageid = $this->page->id;

        socialwiki_delete_comment($commentid, $this->modcontext, $pageid);
    }

}

class page_socialwiki_lock extends page_socialwiki_edit {

    public function print_header() {
        $this->set_url();
    }

    protected function set_url() {
        global $PAGE, $CFG;

        $params = array('pageid' => $this->page->id);

        if ($this->section) {
            $params['section'] = $this->section;
        }

        $PAGE->set_url($CFG->wwwroot . '/mod/socialwiki/lock.php', $params);
    }

    protected function set_session_url() {
    }

    public function print_content() {
        global $USER, $PAGE;

        require_capability('mod/socialwiki:editpage', $this->modcontext, NULL, true, 'noeditpermission', 'socialwiki');

        socialwiki_set_lock($this->page->id, $USER->id, $this->section);
    }

    public function print_footer() {
    }
}

class page_socialwiki_overridelocks extends page_socialwiki_edit {
    function print_header() {
        $this->set_url();
    }

    function print_content() {
        global $CFG, $PAGE;

        require_capability('mod/socialwiki:overridelock', $this->modcontext, NULL, true, 'nooverridelockpermission', 'socialwiki');

        socialwiki_delete_locks($this->page->id, null, $this->section, true, true);

        $args = "pageid=" . $this->page->id;

        if (!empty($this->section)) {
            $args .= "&section=" . urlencode($this->section);
        }

        redirect($CFG->wwwroot . '/mod/socialwiki/edit.php?' . $args, get_string('overridinglocks', 'socialwiki'), 2);
    }

    function set_url() {
        global $PAGE, $CFG;

        $params = array('pageid' => $this->page->id);

        if (!empty($this->section)) {
            $params['section'] = $this->section;
        }

        $PAGE->set_url($CFG->wwwroot . '/mod/socialwiki/overridelocks.php', $params);
    }

    protected function set_session_url() {
    }

    private function print_overridelocks() {
        global $CFG;

        socialwiki_delete_locks($this->page->id, null, $this->section, true, true);

        $args = "pageid=" . $this->page->id;

        if (!empty($this->section)) {
            $args .= "&section=" . urlencode($this->section);
        }

        redirect($CFG->wwwroot . '/mod/socialwiki/edit.php?' . $args, get_string('overridinglocks', 'socialwiki'), 2);
    }

}

/**
 * This class will let user to delete wiki pages and page versions
 *
 */
class page_socialwiki_admin extends page_socialwiki {

    public $view, $action;
    public $listorphan = false;

    /**
     * Constructor
     *
     * @global object $PAGE
     * @param mixed $wiki instance of wiki
     * @param mixed $subwiki instance of subwiki
     * @param stdClass $cm course module
     */
    function __construct($wiki, $subwiki, $cm) {
        global $PAGE;
        parent::__construct($wiki, $subwiki, $cm);
        $PAGE->requires->js_init_call('M.mod_socialwiki.deleteversion', null, true);
    }

    /**
     * Prints header for wiki page
     */
    function print_header() {
        parent::print_header();
        $this->print_pagetitle();
    }

    /**
     * This function will display administration view to users with managewiki capability
     */
    function print_content() {
        //make sure anyone trying to access this page has managewiki capabilities
        require_capability('mod/socialwiki:managewiki', $this->modcontext, NULL, true, 'noviewpagepermission', 'socialwiki');

        //update wiki cache if timedout
        $page = $this->page;
        if ($page->timerendered + SOCIALWIKI_REFRESH_CACHE_TIME < time()) {
            $fresh = socialwiki_refresh_cachedcontent($page);
            $page = $fresh['page'];
        }

        //dispaly admin menu
        echo $this->wikioutput->menu_admin($this->page->id, $this->view);

        //Display appropriate admin view
        switch ($this->view) {
            case 1: //delete page view
                $this->print_delete_content($this->listorphan);
                break;
            case 2: //delete version view
                $this->print_delete_version();
                break;
            default: //default is delete view
                $this->print_delete_content($this->listorphan);
                break;
        }
    }

    /**
     * Sets admin view option
     *
     * @param int $view page view id
     * @param bool $listorphan is only valid for view 1.
     */
    public function set_view($view, $listorphan = true) {
        $this->view = $view;
        $this->listorphan = $listorphan;
    }

    /**
     * Sets page url
     *
     * @global object $PAGE
     * @global object $CFG
     */
    function set_url() {
        global $PAGE, $CFG;
        $PAGE->set_url($CFG->wwwroot . '/mod/socialwiki/admin.php', array('pageid' => $this->page->id));
    }

    /**
     * sets navigation bar for the page
     *
     * @global object $PAGE
     */
    protected function create_navbar() {
        global $PAGE;

        parent::create_navbar();
        $PAGE->navbar->add(get_string('admin', 'socialwiki'));
    }

    /**
     * Show wiki page delete options
     *
     * @param bool $showorphan
     */
    protected function print_delete_content($showorphan = true) {
        $contents = array();
        $table = new html_table();
        $table->head = array('', get_string('pagename','socialwiki'));
        $table->attributes['class'] = 'generaltable mdl-align';
        $swid = $this->subwiki->id;
        if ($showorphan) {
            if ($orphanedpages = socialwiki_get_orphaned_pages($swid)) {
                $this->add_page_delete_options($orphanedpages, $swid, $table);
            } else {
                $table->data[] = array('', get_string('noorphanedpages', 'socialwiki'));
            }
        } else {
            if ($pages = socialwiki_get_page_list($swid)) {
                $this->add_page_delete_options($pages, $swid, $table);
            } else {
                $table->data[] = array('', get_string('nopages', 'socialwiki'));
            }
        }

        ///Print the form
        echo html_writer::start_tag('form', array(
                                                'action' => new moodle_url('/mod/socialwiki/admin.php'),
                                                'method' => 'post'));
        echo html_writer::tag('div', html_writer::empty_tag('input', array(
                                                                         'type'  => 'hidden',
                                                                         'name'  => 'pageid',
                                                                         'value' => $this->page->id)));

        echo html_writer::empty_tag('input', array('type' => 'hidden', 'name' => 'option', 'value' => $this->view));
        echo html_writer::table($table);
        echo html_writer::start_tag('div', array('class' => 'mdl-align'));
        if (!$showorphan) {
            echo html_writer::empty_tag('input', array(
                                                     'type'    => 'submit',
                                                     'class'   => 'socialwiki_form-button',
                                                     'value'   => get_string('listorphan', 'socialwiki'),
                                                     'sesskey' => sesskey()));
        } else {
            echo html_writer::empty_tag('input', array('type'=>'hidden', 'name'=>'listall', 'value'=>'1'));
            echo html_writer::empty_tag('input', array(
                                                     'type'    => 'submit',
                                                     'class'   => 'socialwiki_form-button',
                                                     'value'   => get_string('listall', 'socialwiki'),
                                                     'sesskey' => sesskey()));
        }
        echo html_writer::end_tag('div');
        echo html_writer::end_tag('form');
    }

    /**
     * helper function for print_delete_content. This will add data to the table.
     *
     * @global object $OUTPUT
     * @param array $pages objects of wiki pages in subwiki
     * @param int $swid id of subwiki
     * @param object $table reference to the table in which data needs to be added
     */
    protected function add_page_delete_options($pages, $swid, &$table) {
        global $OUTPUT;
        foreach ($pages as $page) {
            $link = socialwiki_parser_link($page->title, array('swid' => $swid));
            $class = ($link['new']) ? 'class="socialwiki_newentry"' : '';
            $pagelink = '<a href="' . $link['url'] . '"' . $class . '>' . format_string($link['content']) . '</a>';
            $urledit = new moodle_url('/mod/socialwiki/edit.php', array('pageid' => $page->id, 'sesskey' => sesskey()));
            $urldelete = new moodle_url('/mod/socialwiki/admin.php', array(
                                                                   'pageid'  => $this->page->id,
                                                                   'delete'  => $page->id,
                                                                   'option'  => $this->view,
                                                                   'listall' => !$this->listorphan?'1': '',
                                                                   'sesskey' => sesskey()));

            $editlinks = $OUTPUT->action_icon($urledit, new pix_icon('t/edit', get_string('edit')));
            $editlinks .= $OUTPUT->action_icon($urldelete, new pix_icon('t/delete', get_string('delete')));
            $table->data[] = array($editlinks, $pagelink);
        }
    }

    /**
     * Prints lists of versions which can be deleted
     *
     * @global core_renderer $OUTPUT
     * @global moodle_page $PAGE
     */
    private function print_delete_version() {
        global $OUTPUT, $PAGE;
        $pageid = $this->page->id;

        // versioncount is the latest version
        $versioncount = socialwiki_count_wiki_page_versions($pageid) - 1;
        $versions = socialwiki_get_wiki_page_versions($pageid, 0, $versioncount);

        // We don't want version 0 to be displayed
        // version 0 is blank page
        if (end($versions)->version == 0) {
            array_pop($versions);
        }

        $contents = array();
        $version0page = socialwiki_get_wiki_page_version($this->page->id, 0);
        $creator = socialwiki_get_user_info($version0page->userid);
        $a = new stdClass();
        $a->date = userdate($this->page->timecreated, get_string('strftimedaydatetime', 'langconfig'));
        $a->username = fullname($creator);
        echo $OUTPUT->heading(get_string('createddate', 'socialwiki', $a), 4, 'socialwiki_headingtime');
        if ($versioncount > 0) {
            /// If there is only one version, we don't need radios nor forms
            if (count($versions) == 1) {
                $row = array_shift($versions);
                $username = socialwiki_get_user_info($row->userid);
                $picture = $OUTPUT->user_picture($username);
                $date = userdate($row->timecreated, get_string('strftimedate', 'langconfig'));
                $time = userdate($row->timecreated, get_string('strftimetime', 'langconfig'));
                $versionid = socialwiki_get_version($row->id);
                $versionlink = new moodle_url('/mod/socialwiki/viewversion.php', array('pageid' => $pageid, 'versionid' => $versionid->id));
                $userlink = new moodle_url('/user/view.php', array('id' => $username->id, 'course' => $PAGE->cm->course));
                $picturelink = $picture . html_writer::link($userlink->out(false), fullname($username));
                $historydate = $OUTPUT->container($date, 'socialwiki_histdate');
                $contents[] = array('', html_writer::link($versionlink->out(false), $row->version), $picturelink, $time, $historydate);

                //Show current version
                $table = new html_table();
                $table->head = array('', get_string('version'), get_string('user'), get_string('modified'), '');
                $table->data = $contents;
                $table->attributes['class'] = 'mdl-align';

                echo html_writer::table($table);
            } else {
                $lastdate = '';
                $rowclass = array();

                foreach ($versions as $version) {
                    $user = socialwiki_get_user_info($version->userid);
                    $picture = $OUTPUT->user_picture($user, array('popup' => true));
                    $date = userdate($version->timecreated, get_string('strftimedate'));
                    if ($date == $lastdate) {
                        $date = '';
                        $rowclass[] = '';
                    } else {
                        $lastdate = $date;
                        $rowclass[] = 'socialwiki_histnewdate';
                    }

                    $time = userdate($version->timecreated, get_string('strftimetime', 'langconfig'));
                    $versionid = socialwiki_get_version($version->id);
                    if ($versionid) {
                        $url = new moodle_url('/mod/socialwiki/viewversion.php', array('pageid' => $pageid, 'versionid' => $versionid->id));
                        $viewlink = html_writer::link($url->out(false), $version->version);
                    } else {
                        $viewlink = $version->version;
                    }

                    $userlink = new moodle_url('/user/view.php', array('id' => $version->userid, 'course' => $PAGE->cm->course));
                    $picturelink = $picture . html_writer::link($userlink->out(false), fullname($user));
                    $historydate = $OUTPUT->container($date, 'socialwiki_histdate');
                    $radiofromelement = $this->choose_from_radio(array($version->version  => null), 'fromversion', 'M.mod_socialwiki.deleteversion()', $versioncount, true);
                    $radiotoelement = $this->choose_from_radio(array($version->version  => null), 'toversion', 'M.mod_socialwiki.deleteversion()', $versioncount, true);
                    $contents[] = array( $radiofromelement . $radiotoelement, $viewlink, $picturelink, $time, $historydate);
                }

                $table = new html_table();
                $table->head = array(get_string('deleteversions', 'socialwiki'), get_string('version'), get_string('user'), get_string('modified'), '');
                $table->data = $contents;
                $table->attributes['class'] = 'generaltable mdl-align';
                $table->rowclasses = $rowclass;

                ///Print the form
                echo html_writer::start_tag('form', array('action'=>new moodle_url('/mod/socialwiki/admin.php'), 'method' => 'post'));
                echo html_writer::tag('div', html_writer::empty_tag('input', array('type' => 'hidden', 'name' => 'pageid', 'value' => $pageid)));
                echo html_writer::empty_tag('input', array('type' => 'hidden', 'name' => 'option', 'value' => $this->view));
                echo html_writer::empty_tag('input', array('type' => 'hidden', 'name' => 'sesskey', 'value' =>  sesskey()));
                echo html_writer::table($table);
                echo html_writer::start_tag('div', array('class' => 'mdl-align'));
                echo html_writer::empty_tag('input', array('type' => 'submit', 'class' => 'socialwiki_form-button', 'value' => get_string('deleteversions', 'socialwiki')));
                echo html_writer::end_tag('div');
                echo html_writer::end_tag('form');
            }
        } else {
            print_string('nohistory', 'socialwiki');
        }
    }

    /**
     * Given an array of values, creates a group of radio buttons to be part of a form
     * helper function for print_delete_version
     *
     * @param array  $options  An array of value-label pairs for the radio group (values as keys).
     * @param string $name     Name of the radiogroup (unique in the form).
     * @param string $onclick  Function to be executed when the radios are clicked.
     * @param string $checked  The value that is already checked.
     * @param bool   $return   If true, return the HTML as a string, otherwise print it.
     *
     * @return mixed If $return is false, returns nothing, otherwise returns a string of HTML.
     */
    private function choose_from_radio($options, $name, $onclick = '', $checked = '', $return = false) {

        static $idcounter = 0;

        if (!$name) {
            $name = 'unnamed';
        }

        $output = '<span class="radiogroup ' . $name . "\">\n";

        if (!empty($options)) {
            $currentradio = 0;
            foreach ($options as $value => $label) {
                $htmlid = 'auto-rb' . sprintf('%04d', ++$idcounter);
                $output .= ' <span class="radioelement ' . $name . ' rb' . $currentradio . "\">";
                $output .= '<input name="' . $name . '" id="' . $htmlid . '" type="radio" value="' . $value . '"';
                if ($value == $checked) {
                    $output .= ' checked="checked"';
                }
                if ($onclick) {
                    $output .= ' onclick="' . $onclick . '"';
                }
                if ($label === '') {
                    $output .= ' /> <label for="' . $htmlid . '">' . $value . '</label></span>' . "\n";
                } else {
                    $output .= ' /> <label for="' . $htmlid . '">' . $label . '</label></span>' . "\n";
                }
                $currentradio = ($currentradio + 1) % 2;
            }
        }

        $output .= '</span>' . "\n";

        if ($return) {
            return $output;
        } else {
            echo $output;
        }
    }
}
class page_socialwiki_manage extends page_socialwiki{
	
	function print_content(){
		Global $USER,$PAGE,$OUTPUT,$CFG;
		//get the follows and likes for a user
		$follows=socialwiki_get_follows($USER->id,$this->subwiki->id);
		$likes=socialwiki_getlikes($USER->id,$this->subwiki->id);
		
		$html=$this->wikioutput->content_area_begin();
		$html.=$OUTPUT->container_start('socialwiki_manageheading');
		$html.= $OUTPUT->heading('FOLLOWING',1,'colourtext');
		$html.=$OUTPUT->container_end();
		$html .= $OUTPUT->container_start('socialwiki_followlist');
		if (count($follows)==0){
			$html.=$OUTPUT->container_start('socialwiki_manageheading');
			$html.= $OUTPUT->heading('You are not following anyone',3,'colourtext');
			$html.=$OUTPUT->container_end();
		}else{
			//display all the users being followed by the current user
			foreach($follows as $follow){
				$user = socialwiki_get_user_info($follow->usertoid);
				$userlink = new moodle_url('/user/view.php', array('id' => $user->id, 'course' => $PAGE->cm->course));
				$picture = $OUTPUT->user_picture($user, array('popup' => true));
				$html.=$picture;
				$html.=html_writer::link($userlink->out(false),fullname($user),array('class'=>'socialwiki_username socialwiki_link'));
				$html.=html_writer::link($CFG->wwwroot.'/mod/socialwiki/follow.php?user2='.$follow->usertoid.'&from='.urlencode($PAGE->url->out()).'&swid='.$this->subwiki->id,'Unfollow',array('class'=>'socialwiki_unfollowlink socialwiki_link'));
			}
		
		}
		$html .= $OUTPUT->container_end();

		$html.=$OUTPUT->container_start('socialwiki_manageheading');
		$html.='<br/><br/><br/>'. $OUTPUT->heading('LIKES',1,'colourtext');
		$html.=$OUTPUT->container_end();
		if (count($likes)==0){
			$html.=$OUTPUT->container_start('socialwiki_manageheading');
			$html.= $OUTPUT->heading('You have not liked any pages', 3, "colourtext");
			$html.=$OUTPUT->container_end();
		}else{
			//display all the pages the current user likes
			$html .= $OUTPUT->container_start('socialwiki_likelist');
			foreach($likes as $like){
				$page=socialwiki_get_page($like->pageid);
				$html.=html_writer::link($CFG->wwwroot.'/mod/socialwiki/view.php?pageid='.$page->id,$page->title,array('class'=>'socialwiki_link'));
				$html.=html_writer::link($CFG->wwwroot.'/mod/socialwiki/like.php?pageid='.$page->id.'&from='.urlencode($PAGE->url->out()),'Unlike',array('class'=>'socialwiki_unlikelink socialwiki_link'));
				$html .= "<br/><br/>";
			}
			$html .= $OUTPUT->container_end();
		}

		$html.=$this->wikioutput->content_area_end();
		echo $html;
	}
	
	function set_url() {
        global $PAGE, $CFG;
        $params = array('pageid' => $this->page->id);
		$PAGE->set_url($CFG->wwwroot . '/mod/socialwiki/manage.php', $params);
	}
	protected function create_navbar() {
        global $PAGE, $CFG;
        parent::create_navbar();
        $PAGE->navbar->add(get_string('manage', 'socialwiki'), $CFG->wwwroot . '/mod/socialwiki/manage.php?pageid=' . $this->page->id);
    }
}
