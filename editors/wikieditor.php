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
 * This file contains all necessary code to define a wiki editor
 *
 * @package mod-wiki-2.0
 * @copyrigth 2009 Marc Alier, Jordi Piguillem marc.alier@upc.edu
 * @copyrigth 2009 Universitat Politecnica de Catalunya http://www.upc.edu
 *
 * @author Josep Arus
 *
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once($CFG->dirroot.'/lib/formslib.php');
require_once($CFG->dirroot.'/lib/form/textarea.php');

class MoodleQuickForm_socialwikieditor extends MoodleQuickForm_textarea {

    private $files;

    function MoodleQuickForm_socialwikieditor($elementName = null, $elementLabel = null, $attributes = null) {
        if (isset($attributes['socialwiki_format'])) {
            $this->wikiformat = $attributes['socialwiki_format'];
            unset($attributes['socialwiki_format']);
        }
        if (isset($attributes['files'])) {
            $this->files = $attributes['files'];
            unset($attributes['files']);
        }

        parent::MoodleQuickForm_textarea($elementName, $elementLabel, $attributes);
    }

    function setWikiFormat($wikiformat) {
        $this->wikiformat = $wikiformat;
    }

    function toHtml() {
        $textarea = parent::toHtml();

        return $this->{
            $this->wikiformat."Editor"}
            ($textarea);
    }

    function creoleEditor($textarea) {
        return $this->printWikiEditor($textarea);
    }

    function nwikiEditor($textarea) {
        return $this->printWikiEditor($textarea);
    }

    private function printWikiEditor($textarea) {
        global $OUTPUT;

        $textarea = $OUTPUT->container_start().$textarea.$OUTPUT->container_end();

        $buttons = $this->getButtons();

        return $buttons.$textarea;
    }

    private function getButtons() {
        global $PAGE, $OUTPUT, $CFG;

        $editor = $this->wikiformat;

        $tag = $this->getTokens($editor, 'bold');
        $wiki_editor['bold'] = array('ed_bold.gif', get_string('wikiboldtext', 'socialwiki'), $tag[0], $tag[1], get_string('wikiboldtext', 'socialwiki'));

        $tag = $this->getTokens($editor, 'italic');
        $wiki_editor['italic'] = array('ed_italic.gif', get_string('wikiitalictext', 'socialwiki'), $tag[0], $tag[1], get_string('wikiitalictext', 'socialwiki'));

        $imagetag = $this->getTokens($editor, 'image');
        $wiki_editor['image'] = array('ed_img.gif', get_string('wikiimage', 'socialwiki'), $imagetag[0], $imagetag[1], get_string('wikiimage', 'socialwiki'));

        $tag = $this->getTokens($editor, 'link');
        $wiki_editor['internal'] = array('ed_internal.gif', get_string('wikiinternalurl', 'socialwiki'), $tag[0], $tag[1], get_string('wikiinternalurl', 'socialwiki'));

        $tag = $this->getTokens($editor, 'url');
        $wiki_editor['external'] = array('ed_external.gif', get_string('wikiexternalurl', 'socialwiki'), $tag, "", get_string('wikiexternalurl', 'socialwiki'));

        $tag = $this->getTokens($editor, 'list');
        $wiki_editor['u_list'] = array('ed_ul.gif', get_string('wikiunorderedlist', 'socialwiki'), '\\n'.$tag[0], '', '');
        $wiki_editor['o_list'] = array('ed_ol.gif', get_string('wikiorderedlist', 'socialwiki'), '\\n'.$tag[1], '', '');

        $tag = $this->getTokens($editor, 'header');
        $wiki_editor['h1'] = array('ed_h1.gif', get_string('wikiheader', 'socialwiki', 1), '\\n'.$tag.' ', ' '.$tag.'\\n', get_string('wikiheader', 'socialwiki', 1));
        $wiki_editor['h2'] = array('ed_h2.gif', get_string('wikiheader', 'socialwiki', 2), '\\n'.$tag.$tag.' ', ' '.$tag.$tag.'\\n', get_string('wikiheader', 'socialwiki', 2));
        $wiki_editor['h3'] = array('ed_h3.gif', get_string('wikiheader', 'socialwiki', 3), '\\n'.$tag.$tag.$tag.' ', ' '.$tag.$tag.$tag.'\\n', get_string('wikiheader', 'socialwiki', 3));

        $tag = $this->getTokens($editor, 'line_break');
        $wiki_editor['hr'] = array('ed_hr.gif', get_string('wikihr', 'socialwiki'), '\\n'.$tag.'\\n', '', '');

        $tag = $this->getTokens($editor, 'nowiki');
        $wiki_editor['nowiki'] = array('ed_nowiki.gif', get_string('wikinowikitext', 'socialwiki'), $tag[0], $tag[1], get_string('wikinowikitext', 'socialwiki'));

        $PAGE->requires->js('/mod/socialwiki/editors/wiki/buttons.js');

        $html = '<div class="socialwikieditor-toolbar">';
        foreach ($wiki_editor as $button) {
            $html .= "<a href=\"javascript:insertTags";
            $html .= "('".$button[2]."','".$button[3]."','".$button[4]."');\">";
            $html .= html_writer::empty_tag('img', array('alt' => $button[1], 'src' => $CFG->wwwroot . '/mod/socialwiki/editors/wiki/images/' . $button[0]));
            $html .= "</a>";
        }
        $html .= "<label class='accesshide' for='addtags'>" . get_string('insertimage', 'socialwiki')  . "</label>";
        $html .= "<select id='addtags' onchange=\"insertTags('{$imagetag[0]}', '{$imagetag[1]}', this.value)\">";
        $html .= "<option value='" . s(get_string('wikiimage', 'socialwiki')) . "'>" . get_string('insertimage', 'socialwiki') . '</option>';
        foreach ($this->files as $filename) {
            $html .= "<option value='".s($filename)."'>";
            $html .= $filename;
            $html .= '</option>';
        }
        $html .= '</select>';
        $html .= $OUTPUT->help_icon('insertimage', 'socialwiki');
        $html .= '</div>';

        return $html;
    }

    private function getTokens($format, $token) {
        $tokens = socialwiki_parser_get_token($format, $token);

        if (is_array($tokens)) {
            foreach ($tokens as & $t) {
                $this->escapeToken($t);
            }
        } else {
            $this->escapeToken($tokens);
        }

        return $tokens;
    }

    private function escapeToken(&$token) {
        $token = urlencode(str_replace("'", "\'", $token));
    }
}

//register wikieditor
MoodleQuickForm::registerElementType('socialwikieditor', $CFG->dirroot."/mod/socialwiki/editors/wikieditor.php", 'MoodleQuickForm_socialwikieditor');
