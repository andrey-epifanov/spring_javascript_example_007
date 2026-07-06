package org.example.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/timesheets/api")
public class TimesheetApiController {

    @GetMapping("/filters")
    public Map<String, List<String>> getFilters() {
        return Map.of(
                "divisions", List.of("Департамент IT", "Отдел разработки", "Отдел тестирования"),
                "managers", List.of("Павел Иванов", "Сидоров Алексей", "Волков Сергей"),
                "employees", List.of("Петров Иван", "Козлов Дмитрий", "Морозов Никита")
        );
    }

    @GetMapping("/details")
    public List<Map<String, Object>> getDetails(
            @RequestParam String adLogin,
            @RequestParam String dateFrom,
            @RequestParam String dateTo
    ) {
        return List.of(
                Map.of(
                        "code", "PROJ-101",
                        "taskName", "Разработка модуля отчётности",
                        "taskCreated", "2026-06-01",
                        "timesheetDate", dateFrom,
                        "hours", 4.0
                ),
                Map.of(
                        "code", "PROJ-205",
                        "taskName", "Code review",
                        "taskCreated", "2026-06-10",
                        "timesheetDate", dateTo,
                        "hours", 2.5
                )
        );
    }

    @PostMapping("/sync-employee-timesheets")
    public Map<String, String> syncEmployeeTimesheets(@RequestBody Map<String, String> body) {
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(Integer.parseInt(body.getOrDefault("days", "1")) - 1L);
        return Map.of(
                "startDate", start.toString(),
                "endDate", end.toString(),
                "adLogin", body.getOrDefault("adLogin", "")
        );
    }

    @GetMapping("/export")
    public List<Map<String, Object>> exportSummary() {
        return List.of(
                Map.of(
                        "adLogin", "petrov",
                        "employeeName", "Петров Иван",
                        "managerName", "Сидоров Алексей",
                        "divisionName", "Отдел разработки",
                        "totalHours", 36.5,
                        "entriesCount", 12
                )
        );
    }
}
