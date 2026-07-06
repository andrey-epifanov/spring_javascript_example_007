package org.example.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.dto.EmployeeTimesheetDTO;
import org.example.dto.timesheet.TimesheetFilterDTO;
import org.example.service.TimesheetHierarchyService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.time.LocalDate;

@Controller
@RequestMapping("/timesheets-hierarchy")
@RequiredArgsConstructor
@Slf4j
public class TimesheetHierarchyController {

    private final TimesheetHierarchyService timesheetHierarchyService;

    @GetMapping
    public String getTimesheets(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(defaultValue = "false") boolean managerMode,
            Model model
    ) {
        LocalDate from = dateFrom != null ? dateFrom : LocalDate.now().minusWeeks(1);
        LocalDate to = dateTo != null ? dateTo : LocalDate.now();

        model.addAttribute("dateFrom", from);
        model.addAttribute("dateTo", to);
        model.addAttribute("managerMode", managerMode);
        return "timesheets-hierarchy";
    }

    @GetMapping("/api/timesheet-hierarchy")
    @ResponseBody
    public EmployeeTimesheetDTO getHierarchy(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(defaultValue = "Pavelin") String managerLogin,
            @RequestParam(defaultValue = "totalHours") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir
    ) throws Exception {
        TimesheetFilterDTO filter = TimesheetFilterDTO.builder()
                .dateFrom(dateFrom)
                .dateTo(dateTo)
                .managerLogin(managerLogin)
                .sortBy(sortBy)
                .sortDir(sortDir)
                .build();
        return timesheetHierarchyService.generateEnrichedHierarchy(filter);
    }
}
