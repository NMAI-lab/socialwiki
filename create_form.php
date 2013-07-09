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
 * This file contains all necessary code to define and process an edit form
 *
 * @package mod-wiki-2.0
 * @copyright 2010 Dongsheng Cai <dongsheng@moodle.com>
 *
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once($CFG->libdir.'/formslib.php');

class mod_socialwiki_create_form extends moodleform {

    protected function definition() {
        $mform = $this->_form;

        $formats = $this->_customdata['formats'];
        $defaultformat = $this->_customdata['defaultformat'];
        $forceformat = $this->_customdata['forceformat'];

        $mform->addElement('header', 'general', get_string('newpagehdr', 'socialwiki'));

        $textoptions = array();
        if (!empty($this->_customdata['disable_pagetitle'])) {
            $textoptions = array('readonly'=>'readonly');
        }
        $mform->addElement('text', 'pagetitle', get_string('newpagetitle', 'socialwiki'), $textoptions);
        $mform->setType('pagetitle', PARAM_TEXT);
        $mform->addRule('pagetitle', get_string('required'), 'required', null, 'client');

        if ($forceformat) {
            $mform->addElement('hidden', 'pageformat', $defaultformat);
        } else {
            $mform->addElement('static', 'format', get_string('format', 'socialwiki'));
            $mform->addHelpButton('format', 'format', 'socialwiki');
            foreach ($formats as $format) {
                if ($format == $defaultformat) {
                    $attr = array('checked'=>'checked');
                }else if (!empty($forceformat)){
                    $attr = array('disabled'=>'disabled');
                } else {
                    $attr = array();
                }
                $mform->addElement('radio', 'pageformat', '', get_string('format'.$format, 'socialwiki'), $format, $attr);
            }
        }
        $mform->setType('pageformat', PARAM_ALPHANUMEXT);
        $mform->addRule('pageformat', get_string('required'), 'required', null, 'client');

        if (!empty($this->_customdata['groups']->availablegroups)) {
            foreach ($this->_customdata['groups']->availablegroups as $groupdata) {
                $groupinfo[$groupdata->id] = $groupdata->name;
            }
            if (count($groupinfo) > 1) {
                $mform->addElement('select', 'groupinfo', get_string('group'), $groupinfo);
                $mform->setDefault('groupinfo', $this->_customdata['groups']->currentgroup);
            } else {
                $groupid = key($groupinfo);
                $groupname = $groupinfo[$groupid];
                $mform->addElement('static', 'groupdesciption', get_string('group'), $groupname);
                $mform->addElement('hidden', 'groupinfo', $groupid);
            }
        }

        //hiddens
        $mform->addElement('hidden', 'action', 'create');
        $mform->setType('action', PARAM_ALPHA);

        $this->add_action_buttons(false, get_string('createpage', 'socialwiki'));
    }
}
